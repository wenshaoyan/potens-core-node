/**
 * Created by yanshaowen on 2018/4/11.
 */
'use strict';
const {JSONParse} = require('../util/sys-util');
const PotensX = require('../potens-x');
const {randomWord} = require('../util/sys-util');

const isJson = function (o) {
    return typeof o === 'object' && !Array.isArray(o);

};
const isArray = function (o) {
    return Array.isArray(o);
};
const CoreException = require('../exception/core-exception');
/**
 * status:
 2开头 （请求成功）表示成功处理了请求的状态代码。
 200   （成功）  服务器已成功处理了请求。 通常，这表示服务器提供了请求的网页。
 204   （无内容）  服务器成功处理了请求，但没有返回任何内容。


 4开头 （请求错误）这些状态代码表示请求可能出错，妨碍了服务器的处理。
 400   （错误请求） 服务器不理解请求的语法,请求头异常
 404    没找到匹配的routekey

 5开头（服务器错误）这些状态代码表示服务器在尝试处理请求时发生内部错误。 这些错误可能是服务器本身的错误，而不是请求出错。
 500   （服务器内部错误）  服务器遇到错误，无法完成请求。
 520    错误的状态码 客户端设置status错误


 6开头  (请求发生手动触发的异常)
 600 未知异常
 601 参数异常
 602 权限不允许


 8 开头  (请求发生自动捕获的异常)
 800 未捕获的未知异常

 9 框架解析错误
 900 配置错误 rabbitm.connect.gateway不存在
 902 uri 不符合规范


 */

const Context = (function () {
    const _execValidator = Symbol('_execValidator');
    const _execController = Symbol('_execController');
    const _exec = Symbol('_exec');
    const _routerConfig = Symbol('_routerConfig');
    const _execResponse = Symbol('_execResponse');

    /**
     * 执行参数检查的任务
     */
    const execValidator = function () {
        // if (this.routerConfig.validator) {
        //     this.routerConfig.validator();
        // }
        return true;
    };

    /**
     * 执行对应的控制器
     */
    const execController = async function () {
        await this[_routerConfig].controller(this);

    };
    /**
     * 执行响应
     */
    const execResponse = async function () {
        this.response.id = `res-${randomWord(true, 10, 10)}`;
        if (this.body === null || this.body === undefined) {
            this.status = 204;
        } else if (this.status === 200) {
            this.status = 200;
            this.response.body = this.body;
        }
        this.response.server_name = PotensX.get('server_name');
        this.response.service_id = PotensX.get('service_id');

    };
    /**
     * 开始执行
     */
    const exec = async function () {
        await this[_execValidator]();
        await this[_execController]();

    };


    class Context {
        constructor(routerConfig) {
            this.startTime = new Date().getTime(); // 当前ctx创建时间
            this[_routerConfig] = routerConfig;
            this[_execValidator] = execValidator;
            this[_execController] = execController;
            this[_exec] = exec;
            this[_execResponse] = execResponse;
            this.sync = routerConfig.config.sync;
            this.response = {};
            this.request = {
                params: {},
                query: {},
                body: {},
                call_chain: [],
                id: ''
            };
            this._amqpHelperMap = PotensX.get('amqpConnectMap');
            this._status = null;
            this._body = null;

        }


        get body() {
            return this._body;
        }

        set body(value) {
            this.status = 200;
            this._body = value;
        }

        get status() {
            return this._status;
        }

        set status(value) {
            if (isNaN(value)) value = 520;
            this.response.status = value;
            this._status = value;
        }

        /**
         *
         * @param buffer    消息buf
         * @return {*}      code>1: 消息体不符合规范  code=0 消息正常被消费  code=-1: 保留
         */
        async consume(buffer) {
            const disposeResult = this.contentCheck(buffer);
            if (disposeResult.code !== 0) {
                this.status = 400;
                return;
            }
            try {
                await this[_exec]();
            } catch (e) {
                if (e.name === 'CoreException') {
                    this.status = e.toJson().code;
                    this.response.error_message = e.toString();
                }else {
                    this.status = 800;
                    this.response.error_message = e.message;
                }
            }finally {
                this[_execResponse]();
            }
        }

        contentCheck(buffer) {
            const disposeResult = {};
            const str = buffer.toString();
            const jsonRe = JSONParse(str);
            if (jsonRe === false) {
                disposeResult.code = 1;
                disposeResult.message = `consume fail! message=${str} is not a standard json`;
                return disposeResult;
            }
            if (isJson((jsonRe.params))) this.request.params = jsonRe.params;
            if (isJson((jsonRe.query))) this.request.query = jsonRe.query;
            if (isJson((jsonRe.body))) this.request.body = jsonRe.body;
            if (isArray((jsonRe.call_chain))) this.request.call_chain = jsonRe.call_chain;
            if (typeof jsonRe.id === 'string') this.request.id = jsonRe.id;
            if (typeof jsonRe.server_name === 'string') this.request.server_name = jsonRe.server_name;
            if (typeof jsonRe.service_id === 'string') this.request.service_id = jsonRe.service_id;

            disposeResult.code = 0;

            return disposeResult;

        }


        get amqpHelperMap() {
            return this._amqpHelperMap;
        }

        set amqpHelperMap(value) {
            this._amqpHelperMap = value;
        }

        localRouter(routerName, routerKey) {

        }

        async remotePubRouter(conn, ex, routerKey, body) {
            const amqpConnect = this.amqpHelperMap.get(conn);
            if (amqpConnect) {
                return await amqpConnect.pubTopic(ex, routerKey, body);
            } else {
                this.throw(500, `remoterRpcRouter: config.rabbitmq.connect not found ${conn}`);
            }
        }

        async remoterRpcRouter(conn, ex, routerKey, body) {
            const amqpConnect = this.amqpHelperMap.get(conn);
            if (amqpConnect) {
                return await amqpConnect.rpcTopic(ex, routerKey, body);
            } else {
                this.throw(500, `remoterRpcRouter: config.rabbitmq.connect not found ${conn}`);
            }
        }

        throw(code, message) {
            const e = new Error();
            code = +code;
            if (isNaN(code) || code < 600 || code >= 800) code = 600;
            if (!message) message = '未知异常';
            throw new CoreException({
                code: code,
                message: message,
                fullMessage: e.stack,
                type: 'router-throw',
                serverName: PotensX.get('server_name')
            })
        }
    }

    return Context;

})();
module.exports = Context;