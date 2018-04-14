/**
 * Created by yanshaowen on 2018/4/9.
 * amqp操作类
 */
'use strict';
const amqpConnectMap = new Map();
const CoreError = require('../exception/core-error');
const {loadDirFiles} = require('../util/sys-util');
const RouterBean = require('../bean/router');
const path = require('path');
const Context = require('../bean/context');
let coreLog;

let amqp = null;
class AmqpConnect {
    constructor(config) {
        this._config = config;
        this._conn = null;
        this._ch = null;
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

    async connect() {
        this.conn = await amqp.connect(this.config);
        this.ch = await this.conn.createChannel();
        await this.ch.prefetch(100);
    }

    async _bindQueue(routerConfig) {
        await this.ch.assertQueue(routerConfig.config.queueName, {durable: false, autoDelete: true});
        await this.ch.bindQueue(routerConfig.config.queueName, routerConfig.config.ex, routerConfig.config.routerKey);
        this.ch.consume(routerConfig.config.queueName, async(msg) => {
            const ctx = new Context(routerConfig);
            const consumeResult = await ctx.consume(msg.content);
            if (consumeResult.code > 0) {
                coreLog.warn(consumeResult.message);
            }
            if (!ctx.sync) {
                // console.log(this.body);
                this.ch.sendToQueue(msg.properties.replyTo,
                    Buffer.from(JSON.stringify(ctx.body)),
                    {correlationId: msg.properties.correlationId});
            }
            this.ch.ack(msg);
        }, {noAck: false});

    }

    async pubTopic(routerKey, message) {
        if (message === undefined || message === undefined) {
            message = {};
        }
        CoreError.isJson(message, 'pubSendTopic: params message not is json');
        message = JSON.stringify(message);
        await this.ch.publish('amq.topic', routerKey, Buffer.from(message));
    }

    async rpcTopic(routerKey, message) {

    }
}
class AmqpHelper {
    static async start(allConfig, projectDir, _coreLog) {
        coreLog = _coreLog;
        if (!amqp) amqp = require('amqplib');
        for (let name in allConfig.connects) {
            const amqpConnect = new AmqpConnect(allConfig.connects[name]);
            amqpConnectMap.set(name, amqpConnect);
            await amqpConnect.connect();
            const consume_config = allConfig.connects[name].consume_config;
            if (consume_config && consume_config.router_dir) {
                CoreError.isStringNotNull(consume_config.router_dir, `rabbitmq.${name}.consume_config.router_dir not a string`);
                CoreError.isStringNotNull(consume_config.default_ex, `rabbitmq.${name}.consume_config.default_ex not a string`);
                CoreError.isBool(consume_config.default_sync, `rabbitmq.${name}.consume_config.default_ex not a boolean`);

                let list = [projectDir];
                list = list.concat(consume_config.router_dir.split('.'));
                const pathList = loadDirFiles(path.join(...list));
                CoreError.isArray(pathList, `loadDirFiles error! path=${path.join(...list)} not exist`);
                const routerBean = new RouterBean(pathList, consume_config.router_dir, coreLog, {
                    ex: consume_config.default_ex,
                    sync: consume_config.default_sync
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
        /*const amqpConnect = amqpConnectMap.get('admin_service');
         // 添加监听
         Object.keys(routers).forEach(routerName => {
         const router = routers[routerName];
         if (router.controller) {

         }
         if (router.config){
         router.config.o.config.forEach(v => amqpConnect._bindQueue(`admin_service.${routerName}`, 'amq.topic', v));

         }


         if (router.validator) {


         }
         console.log(router)
         });*/

        // coreLog.debug(routers);

    }

    static getConnect(name) {
        if (amqpConnectMap.has(name)) {
            return amqpConnectMap.get(name);
        } else {
            throw new CoreError(`${name} not in rabbitmq.connect`, 100);
        }
    }

}
module.exports = AmqpHelper;




