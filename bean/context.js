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
        const response = {
            id: `res-${randomWord(true, 10, 10)}`,
        };
        if (this.body === null || this.body === undefined) {
            response['status'] = 204;
        } else {
            response['status'] = 200;
            response['body'] = this.body;
        }
        response.server_name = PotensX.get('server_name');
        response.service_id = PotensX.get('service_id');
        this.response = response;

    };
    /**
     * 开始执行
     */
    const exec = async function () {
        await this[_execValidator]();
        await this[_execController]();
        this[_execResponse]();
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
        }

        /**
         *
         * @param buffer    消息buf
         * @return {*}      code>1: 消息体不符合规范  code=0 消息正常被消费  code=-1: 保留
         */
        async consume(buffer) {
            const disposeResult = this.contentCheck(buffer);
            if (disposeResult.code != 0) {
                return disposeResult;
            }
            await this[_exec]();
            return {code: 0};
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


        localRouter() {

        }

        remotePubRouter() {

        }

        remoterRpcRouter() {

        }
    }
    return Context;

})();
module.exports = Context;