/**
 * Created by yanshaowen on 2018/4/11.
 */
'use strict';
// 启动时间
const startTime = new Date().getTime();
const {JSONParse} = require('../util/sys-util');
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
     * 开始执行
     */
    const exec = async function () {
        await this[_execValidator]();
        await this[_execController]();
    };
    class Context {
        constructor(routerConfig) {
            this.createTime = new Date().getTime(); // 当前ctx创建时间
            this[_routerConfig] = routerConfig;
            this[_execValidator] = execValidator;
            this[_execController] = execController;
            this[_exec] = exec;
            this.sync = routerConfig.config.sync;
            this.request = {
                params: {},
                query: {},
                body: {},
                call_chain: []
            };
            // this.respose


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
            // if (isJson((jsonRe.body))) this.request.body = jsonRe.body;

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