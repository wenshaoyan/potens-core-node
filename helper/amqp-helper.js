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
                let err = null,result = undefined;
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

        this.ch.consume(routerConfig.config.queueName, async (msg) => {
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
    async checkExchange(ex){
        try {
            await this.checkCh.checkExchange(ex);
            return true;
        }catch (e) {
            return false;
        }
    }
    pubTopic(ex, routerKey, message) {
        return this._send(ex, routerKey, message, true);
    }

    async rpcTopic(ex, routerKey, message) {
        // 推送消息的ch
        const sendCh = await this.conn.createConfirmChannel();
        AmqpConnect.checkMessage(message);
        const reqId = `req-${randomWord(true, 10, 10)}`;
        message.id = reqId;
        message = JSON.stringify(message);
        const corrId = (this.rpc_id++) + '';
        if (!this.checkExchange(ex)) {
            return false;
        }
        sendCh.on('return', (msg) => {
            sendCh.close();
            const logger = PotensX.get('core_log');
            const reqId = msg.properties.headers.id;
            if (!reqId) {
                logger.warn(`publish event return: msg.headers.id not a string`);
            } else if (!this.send_callback[reqId]) {
                logger.error(`publish event return: msg.headers.id not in publish_callback`);
            } else {
                this.send_callback[reqId]({
                    code: 404,
                    type: 'router',
                    serverName: PotensX.get('server_name'),
                    message: `ex=${msg.fields.exchange}, routerKey=${msg.fields.routingKey},not found routerKey`
                }, null);
            }
        });
        const p = new Promise((resolve, reject) => {
            this.send_callback[reqId] = function (err, msg) {
                if (err) reject(err);
                else resolve(msg);
            };
            this.rpc_callback[corrId] = function (err, msg) {
                if (err) reject(err);
                else resolve(msg);
            };
        });

        sendCh.publish(ex, routerKey, Buffer.from(message), {
            correlationId: corrId, replyTo: this.rpc_queue,
            headers: {id: reqId},
            mandatory: true
        });
        return p;
    }

    async _send(ex, routerKey, message, sync){
        let corrId;
        const reqId = `req-${randomWord(true, 10, 10)}`;
        const options =  {
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
        sendCh.on('return', (msg) => {
            sendCh.close();
            const logger = PotensX.get('core_log');
            const reqId = msg.properties.headers.id;
            if (!reqId) {
                logger.warn(`publish event return: msg.headers.id not a string`);
            } else if (!this.send_callback[reqId]) {
                logger.error(`publish event return: msg.headers.id not in publish_callback`);
            } else {
                this.send_callback[reqId]({
                    code: 404,
                    type: 'router',
                    serverName: PotensX.get('server_name'),
                    message: `ex=${msg.fields.exchange}, routerKey=${msg.fields.routingKey},not found routerKey`
                }, null);
            }
        });
        const p = new Promise((resolve, reject) => {
            this.send_callback[reqId] = function (err, msg) {
                if (err) reject(err);
                else resolve(msg);
            };
            if (!sync) {
                this.rpc_callback[corrId] = function (err, msg) {
                    if (err) reject(err);
                    else resolve(msg);
                }
            }
        });
        sendCh.publish(ex, routerKey, Buffer.from(message), options,function (err, ok) {
            if (err) {
                this.send_callback[reqId]();

            } else {
            }
        });
        return p;
    }
    onChannelError(name) {
        if (name === 'init' || name === 'ch') {
            this.ch.on('error', (error) => {
                if (error.code !== 404) PotensX.get('core_log').error('ch error',error);
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