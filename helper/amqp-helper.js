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
const PotensX = require('../potens-x');

let amqp = null;
class AmqpConnect {
    constructor(config) {
        this._config = config;
        this._conn = null;
        this._ch = null;
        this.routerConfigList = [];

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
        this.onChannelError();
        /*try{
            await this.ch.checkExchange('amq.topic1');
        }catch (e){

        }*/
    }

    async _bindQueue(routerConfig) {
        this.routerConfigList.push(routerConfig);
        await this.ch.assertQueue(routerConfig.config.queueName, {durable: false, autoDelete: true});
        await this.ch.bindQueue(routerConfig.config.queueName, routerConfig.config.ex, routerConfig.config.routerKey);

        this.ch.consume(routerConfig.config.queueName, async(msg) => {
            const ctx = new Context(routerConfig);
            const consumeResult = await ctx.consume(msg.content);
            if (consumeResult.code > 0) {
                PotensX.get('core_log').warn(consumeResult.message);
            }
            // 如果为rpc请求 怎进行响应
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

            PotensX.get('core_log').info(`routerKey=${routerConfig.config.routerKey} ${ctx.response.status} ${ctx.endTime-ctx.startTime}ms`)
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
    onChannelError() {
        this.ch.on('error',  (error) => {
            PotensX.get('core_log').error('111',error);
        });
        this.ch.on('close', (error) => {
            this.channelReconnection();
            PotensX.get('core_log').error('222',error);
        });
    }
    // channel进行重连
    async channelReconnection() {
        this.ch = await this.conn.createChannel();
        await this.ch.prefetch(100);
        this.onChannelError();
        this.routerConfigList.forEach(v => {
            this._bindQueue(v);
        });
        PotensX.get('core_log').info('ch reconnection Success');

    }
    close(){
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
                CoreError.isBool(consume_config.default_sync, `rabbitmq.${name}.consume_config.default_ex not a boolean`);

                let list = [projectDir];
                list = list.concat(consume_config.router_dir.split('.'));

                const pathList = loadDirFiles(path.join(...list));
                CoreError.isArray(pathList, `loadDirFiles error! path=${path.join(...list)} not exist`);
                const routerBean = new RouterBean(pathList, consume_config.router_dir, {
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
    static getAllConnectMap(){
        return amqpConnectMap;
    }

}
module.exports = AmqpHelper;




