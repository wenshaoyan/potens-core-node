/**
 * Created by wenshao on 2017/9/9.
 * 路由日志模块
 */
'use strict';
const reIpv4 = '.*:.*:.*:(.*)';
const CoreError = require('../exception/core-error');

function routerLog(opt) {
    CoreError.isJson(opt, `opt not is json`);
    CoreError.keyExist(opt, 'logger',  `opt not is json`);
    CoreError.isLogger(opt.logger, 'logger',  `opt not is json`);

    const logger = opt.logger;
    return async function (ctx, next) {
        const input = new Date().getTime();
        await next();
        const out = new Date().getTime();
        let ipv4 = ctx.ip.match(reIpv4);
        if (ipv4 instanceof Array && ipv4.length === 2) ipv4 = ipv4[1];
        else if (ipv4 === null) ipv4 = ctx.ip;
        else ctx.ipv4 = ipv4;
        if (ctx.method !== 'OPTIONS')
        logger.info(ipv4,ctx.method,ctx.url,ctx.status,`${out-input}ms`);
    }
}
module.exports = routerLog;

