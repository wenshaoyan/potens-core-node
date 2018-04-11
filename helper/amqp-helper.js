/**
 * Created by yanshaowen on 2018/4/9.
 * amqp操作类
 */
'use strict';
const amqpConnectMap = new Map();
const CoreError = require('../exception/core-error');
const {loadDirFiles} = require('../util/sys-util');
const path = require('path');
const ex = {

};

let amqp = null;
class AmqpConnect{
    constructor(config){
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
    async _bindQueue(queue, ex, routerKey, callback) {
        await this.ch.assertQueue(queue,{durable: false,autoDelete: true});
        await this.ch.bindQueue(queue, ex, routerKey);
        this.ch.consume(queue, function (msg) {
            const ctx = {};

        });

    }
    async pubTopic(routerKey,message) {
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
class AmqpHelper{
    static async start(allConfig, projectDir){
        amqp = require('amqplib');

        for (let name in allConfig.connects) {
            const amqpConnect = new AmqpConnect(allConfig.connects[name]);
            amqpConnectMap.set(name, amqpConnect);
            await amqpConnect.connect();
        }
        for (let router of allConfig.routers) {
            if (amqpConnectMap.has(router.mq_name)){
                const amqpConnect = amqpConnectMap.get(router.mq_name);
                let list = [projectDir];
                list = list.concat(router.router_dir.split('.'));
                if (Array.isArray(loadDirFiles(path.join(...list)))) {

                } else {
                    throw new CoreError({code: 100, message: `${router.mq_name} not in rabbitmq.connect`})
                }

            } else {
                throw new CoreError({code: 100, message: `${router.mq_name} not in rabbitmq.connect`})
            }
            // console.log(router)
        }
    }
    static getConnect(name) {
        if (amqpConnectMap.has(name)){
            return amqpConnectMap.get(name);
        } else {
            throw new CoreError({code: 100, message: `${name} not in rabbitmq.connect`})
        }
    }

}
module.exports = AmqpHelper;




