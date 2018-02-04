/**
 * Created by wenshao on 2017/9/9.
 * 路由日志模块
 */
'use strict';
const reIpv4 = '.*:.*:.*:(.*)';
const log4js = require('log4js');

function routerLog(opt) {
    const logger = log4js.getLogger()
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

