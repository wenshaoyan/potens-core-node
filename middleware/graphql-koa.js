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
    return async (ctx, next) => {
        await graphqlKoa({
            schema: options.schema,
            context: {
                ctx: ctx,
            },
            tracing: true,
            formatResponse: (data, all) => {
                let ipv4 = ctx.ip.match(reIpv4);
                if (ipv4 instanceof Array && ipv4.length === 2) ipv4 = ipv4[1];
                else if (ipv4 === null) ipv4 = ctx.ip;
                else ctx.ipv4 = ipv4;
                if (ctx.method !== 'OPTIONS') logger.info(ipv4, `${data.extensions.tracing.duration / 1000}ms`, all.query);
                delete data.extensions;
                return data;
            }
        })(ctx);
    }
}

module.exports = graphqlKoaLog;