/**
 * Created by wenshao on 2017/9/9.
 * graphql-koa
 * 增加访问日志
 * 增加context
 */
const reIpv4 = '.*:.*:.*:(.*)';
const LogDefault = require('../util/log-default-util');

function graphqlKoaLog(options) {
    const {graphqlKoa} = require('apollo-server-koa');
    const logger = options.log && 'info' in options.log ? options.log : new LogDefault();
    const trimRe = /[\r\n]/g;
    return async (ctx, next) => {
        ctx.request_self_id = new Date().getTime() + '-' + Math.random().toString(36).substr(2);
        if (ctx.request.body) {
            if (typeof ctx.request.body.variables !== 'string' || ctx.request.body.variables.replace(/^\s+|\s+$/g, '').length === 0) {
                ctx.request.body.variables = '{}';
            }
        }
        let ipv4 = ctx.ip.match(reIpv4);
        if (ipv4 instanceof Array && ipv4.length === 2) ipv4 = ipv4[1];
        else if (ipv4 === null) ipv4 = ctx.ip;
        else ctx.ipv4 = ipv4;
        await graphqlKoa({
            schema: options.schema,
            context: {
                ctx: ctx,
            },
            tracing: true,
            formatError(error) {
                logger.error(`[${ctx.request_self_id}]`,`[${ipv4}]`, `-`,
                    `[${ctx.request.body.query.replace(trimRe, '')}]`,  `[${ctx.request.body.variables.replace(trimRe, '')}]`);
                return error;
            },
            formatResponse: (data, all) => {
                if (ctx.method !== 'OPTIONS') logger.info(`[${ctx.request_self_id}]`,`${ipv4}`, `${data.extensions.tracing.duration / 1000}ms`,
                    `[${all.query.replace(trimRe, '')}]`,  `[${JSON.stringify(all.variables)}]`);
                delete data.extensions;
                return data;
            },
            debug: false
        })(ctx);

        if (ctx.status !== 200){
            logger.error(`[${ctx.request_self_id}]`,`${ipv4}`, `-`,
                `[${ctx.request.body.query.replace(trimRe, " ")}]`,  `[${ctx.request.body.variables.replace(trimRe, " ")}]`, [ctx.body]);
        }
    }
}

module.exports = graphqlKoaLog;