/**
 * Created by yanshaowen on 2018/4/9.
 * amqp操作类
 */
'use strict';
const amqpConnectMap = new Map();
const CoreError = require('../exception/core-error');
const CoreException = require('../exception/core-exception');
const {loadDirFiles, JSONParse, randomWord} = require('../util/sys-util');
const RouterBean = require('../bean/router');
const path = require('path');
const Context = require('../bean/context');
const PotensX = require('../potens-x');
PotensX.set('amqpConnectMap', amqpConnectMap);

let amqp = null;

class AmqpConnect {
    constructor(config) {
        this._config = config;
        this._conn = null;
        this._ch = null;
        this.routerConfigList = [];
        this.rpc_id = 0;
        this._rpc_queue = null;
        this.rpc_callback = {};
        this.send_callback = {};
        this._checkCh = null;

    }

    get config() {
        return this._config;
    }

    set config(value) {
        this._config = value;
    }

    get conn() {
        return this._conn;
    }

    set conn(value) {
        this._conn = value;
    }

    get ch() {
        return this._ch;
    }

    set ch(value) {
        this._ch = value;
    }


    get rpc_queue() {
        return this._rpc_queue;
    }

    set rpc_queue(value) {
        this._rpc_queue = value;
    }

    get checkCh() {
        return this._checkCh;
    }

    set checkCh(value) {
        this._checkCh = value;
    }

    static checkMessage(message) {
        if (message === null || message === undefined) {
            message = {};
        }
        CoreError.isJson(message, 'pubSendTopic: params message not is json');
        return JSON.stringify(message);
    }

    async connect() {
        this.conn = await amqp.connect(this.config);
        this.ch = await this.conn.createChannel();
        this.checkCh = await this.conn.createChannel();
        await this.ch.prefetch(100);
        await this.checkCh.prefetch(100);
        this.onChannelError('init');
        const rpcQueue = await this.ch.assertQueue('', {exclusive: true});
        this.rpc_queue = rpcQueue.queue;
        this.ch.consume(this.rpc_queue, (msg) => {
            const currentId = msg.properties.correlationId;
            if (currentId in this.rpc_callback) {
                let content = msg.content.toString();
                const jsonContent = JSONParse(content);
                let err = null, result = undefined;
                if (jsonContent === false) {
                    err = new CoreException({
                        code: 400,
                        type: 'json-parse',
                        serverName: PotensX.get('server_name'),
                        message: `content=${content} not is json`
                    });
                } else if (jsonContent.status !== 200) {
                    err = new CoreException({
                        code: jsonContent.status,
                        type: 'res-status',
                        serverName: PotensX.get('server_name'),
                        message: jsonContent.message
                    });
                } else {
                    result = jsonContent.body;
                }
                this.rpc_callback[currentId](err, result);
            } else {
                PotensX.get('core_log').debug(`rpc_consume: not found currentId=${currentId} in rpc_callback`);
            }

        }, {noAck: true});
    }

    async _bindQueue(routerConfig) {
        await this.ch.assertExchange(routerConfig.config.ex, 'topic', {durable: false});
        this.routerConfigList.push(routerConfig);
        await this.ch.assertQueue(routerConfig.config.queueName, {durable: false, autoDelete: true});
        await this.ch.bindQueue(routerConfig.config.queueName, routerConfig.config.ex, routerConfig.config.routerKey);

        this.ch.consume(routerConfig.config.queueName, async(msg) => {
            const ctx = new Context(routerConfig);
            await ctx.consume(msg.content);
            // 如果为rpc请求 则进行响应
            if (msg.properties.correlationId !== undefined
                &&
                msg.properties.replyTo !== undefined
            ) {
                this.ch.sendToQueue(msg.properties.replyTo,
                    Buffer.from(JSON.stringify(ctx.response)),
                    {correlationId: msg.properties.correlationId});
            }
            this.ch.ack(msg);
            ctx.endTime = new Date().getTime();
            if (ctx.response.status === 200) {
                PotensX.get('core_log').info(`routerKey=${routerConfig.config.routerKey} ${ctx.response.status} ${ctx.endTime - ctx.startTime}ms`)
            } else {
                PotensX.get('core_log').error(`routerKey=${routerConfig.config.routerKey},error_message=${ctx.response.error_message} ${ctx.response.status} ${ctx.endTime - ctx.startTime}ms`)
            }
        }, {noAck: false});

    }

    async checkExchange(ex) {
        try {
            await this.checkCh.checkExchange(ex);
            return true;
        } catch (e) {
            return false;
        }
    }

    pubTopic(ex, routerKey, message, option) {
        option = this._getSendArgsOption(option);
        return this._send(ex, routerKey, message, true, option);
    }

    rpcTopic(ex, routerKey, message, option) {
        option = this._getSendArgsOption(option);
        return this._send(ex, routerKey, message, false, option);
    }

    // 检查调用发送消息的函数参入的option是否合法 不合法则采用配置中的默认值
    _getSendArgsOption(option) {
        const argsOption = {};
        if (typeof option === 'object') {
            if (option.publish_timeout > 0 && option.publish_timeout < 30000) {
                argsOption.publish_timeout = option.publish_timeout;
            }
            if (option.rpc_reply_timeout > 0 && option.rpc_reply_timeout < 30000) {
                argsOption.rpc_reply_timeout = option.rpc_reply_timeout;
            }
        } else {
            argsOption.publish_timeout = this.config.default_config.publish_timeout;
            argsOption.rpc_reply_timeout = this.config.default_config.rpc_reply_timeout;
        }
        return argsOption;
    }

    // 统一发送消息的send函数
    async _send(ex, routerKey, message, sync, option) {
        let corrId;
        let publishTimer;
        let rpcReplyTimer;
        const reqId = `req-${randomWord(true, 10, 10)}`;
        const options = {
            headers: {id: reqId},
            mandatory: true
        };
        if (!sync) {
            corrId = (this.rpc_id++) + '';
            options.correlationId = corrId;
            options.replyTo = this.rpc_queue;
        }
        // 推送消息的ch
        const sendCh = await this.conn.createConfirmChannel();
        AmqpConnect.checkMessage(message);

        message.id = reqId;
        message = JSON.stringify(message);
        if (!await this.checkExchange(ex)) {
            return false;
        }
        const sendResultCallback = (errCode, reqId, ex, routerKey) => {
            sendCh.close();
            const logger = PotensX.get('core_log');
            const errorMessage = {
                type: 'rabbitmq',
                serverName: PotensX.get('server_name'),
            };
            if (!this.send_callback[reqId]) {
                logger.error(`ex=${ex}, routerKey=${routerKey}, msg.headers.id not in publish_callback`);
            } else if (errCode === 404) {
                errorMessage.type = 'router';
                errorMessage.code = errCode;
                errorMessage.message = `ex=${ex}, routerKey=${routerKey}, not found routerKey`;
                this.send_callback[reqId](errorMessage, null);
            } else if (errCode === 903) {
                errorMessage.code = errCode;
                errorMessage.message = `ex=${ex}, routerKey=${routerKey}, rabbitmq recv error`;
                this.send_callback[reqId](errorMessage, null);
            } else if (errCode === 1000) {
                errorMessage.code = errCode;
                errorMessage.message = `ex=${ex}, routerKey=${routerKey}, rabbitmq publish timeout`;
                this.send_callback[reqId](errorMessage, null);
            } else if (errCode) {
                errorMessage.code = errCode;
                errorMessage.message = `ex=${ex}, routerKey=${routerKey}, unknown error`;
                this.send_callback[reqId](errorMessage, null);
            } else {
                this.send_callback[reqId](null, true);
            }
        };
        sendCh.on('return', () => sendResultCallback(404, reqId, ex, routerKey));
        const p = new Promise((resolve, reject) => {
            this.send_callback[reqId] = function (err, msg) {   // sync所有的响应都会回调这个方法 rpc只有在basic.return事件时候才会调用
                clearTimeout(publishTimer);
                clearTimeout(rpcReplyTimer);
                if (err) reject(new CoreException(err));
                else resolve(msg);
            };
            if (!sync) {    // rpc的响应回调事件
                this.rpc_callback[corrId] = function (err, msg) {
                    clearTimeout(rpcReplyTimer);
                    if (err) reject(new CoreException(err));
                    else resolve(msg);
                }

            }
        });
        publishTimer = setTimeout(() => {
            sendResultCallback(1000, reqId, ex, routerKey);
        }, option.publish_timeout);
        if (!sync) {
            rpcReplyTimer = setTimeout(() => {  // rpc queue的回调方法
                sendCh.close();
                if (!this.rpc_callback[corrId]) {
                    PotensX.get('core_log').error(`ex=${ex}, routerKey=${routerKey}, msg.headers.id not in rpc_callback`);
                } else {
                    this.rpc_callback[corrId]({
                        code: 1001,
                        type: 'rpc_reply_timeout',
                        serverName: PotensX.get('server_name'),
                        message: `ex=${ex}, routerKey=${routerKey},  rpc reply timeout`
                    }, null);
                }

            }, option.rpc_reply_timeout);
        }

        sendCh.publish(ex, routerKey, Buffer.from(message), options, function (err, ok) {
            // sync 和rpc 调用后的出错 则会触发 sendResultCallback。
            // 如果正常调用sync会进过sendResultCallback进行响应，rpc不进过sendResultCallback 所以需要另外清除publish时候的定时器 进入等待rpc queue响应阶段
            if (err) {
                sendResultCallback(903, reqId, ex, routerKey);
            } else if (sync) {
                sendResultCallback(null, reqId, ex, routerKey);
            } else {    // 清除rpc send的定时器
                clearTimeout(publishTimer);
            }
        });


        return p;
    }

    onChannelError(name) {
        if (name === 'init' || name === 'ch') {
            this.ch.on('error', (error) => {
                if (error.code !== 404) PotensX.get('core_log').error('ch error', error);
            });
            this.ch.on('close', () => {
                this.channelReconnection('ch');
                PotensX.get('core_log').debug('ch close');
            });
        }
        if (name === 'init' || name === 'checkCh') {
            this.checkCh.on('error', (error) => {
                if (error.code !== 404) PotensX.get('core_log').error('ch error', error);
            });
            this.checkCh.on('close', () => {
                this.channelReconnection('checkCh');
                PotensX.get('core_log').debug('ch close');
            });
        }

    }

    // channel进行重连
    async channelReconnection(chname) {
        this[chname] = await this.conn.createChannel();
        await this.ch.prefetch(100);
        this.onChannelError(chname);

        if (chname === 'ch') {
            this.routerConfigList.forEach(v => {
                this._bindQueue(v);
            });
        }
        PotensX.get('core_log').debug(`${chname} reconnection Success`);

    }

    close() {
        this.conn.close();
    }

}

class AmqpHelper {
    static async start(allConfig) {
        const projectDir = PotensX.get('project_dir');
        if (!amqp) amqp = require('amqplib');
        for (let name in allConfig.connects) {
            const current = allConfig.connects[name];
            const default_config = {
                "publish_timeout": 3000,
                "rpc_reply_timeout": 3000,
            };

            if (current.default_config) {
                if (current.default_config.publish_timeout) {
                    if (current.default_config.publish_timeout > 0 && current.default_config.publish_timeout < 30000) {
                        default_config.publish_timeout = current.default_config.publish_timeout;
                    } else {
                        PotensX.get('core_log').warn(`rabbitmq.${name}.default_config.publish_timeout=${current.default_config.publish_timeout}. must be number and 0<value<30000,The current will use the default value=3000`);
                    }
                }
                if (current.default_config.rpc_reply_timeout) {
                    if (current.default_config.rpc_reply_timeout > 0 && current.default_config.rpc_reply_timeout < 30000) {
                        default_config.rpc_reply_timeout = current.default_config.rpc_reply_timeout;
                    } else {
                        PotensX.get('core_log').warn(`rabbitmq.${name}.default_config.rpc_reply_timeout=${current.default_config.rpc_reply_timeout}. must be number and 0<value<30000,The current will use the default value=3000`);
                    }
                }
            }
            current.default_config = default_config;
            const amqpConnect = new AmqpConnect(allConfig.connects[name]);
            amqpConnectMap.set(name, amqpConnect);
            await amqpConnect.connect();
            const consume_config = allConfig.connects[name].consume_config;
            if (consume_config && consume_config.router_dir) {
                CoreError.isStringNotNull(consume_config.router_dir, `rabbitmq.${name}.consume_config.router_dir not a string`);
                CoreError.isStringNotNull(consume_config.default_ex, `rabbitmq.${name}.consume_config.default_ex not a string`);
                let list = [projectDir];
                list = list.concat(consume_config.router_dir.split('.'));

                const pathList = loadDirFiles(path.join(...list));
                CoreError.isArray(pathList, `loadDirFiles error! path=${path.join(...list)} not exist`);
                const routerBean = new RouterBean(pathList, consume_config.router_dir, {
                    ex: consume_config.default_ex,
                });


                Object.keys(routerBean.routerKeys).forEach(ex => {
                    const currentRouterConfigs = routerBean.routerKeys[ex];
                    Object.keys(currentRouterConfigs).forEach(key => {
                        const currentRouterConfig = currentRouterConfigs[key];
                        amqpConnect._bindQueue(currentRouterConfig);
                    })

                })
            }
        }

    }

}

module.exports = AmqpHelper;