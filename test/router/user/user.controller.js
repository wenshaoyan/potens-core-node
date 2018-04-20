module.exports = {
    users: async (ctx) => {
        ctx.body = [{
            user_id: 1,
            user_name: 'admin'
        }];
        // ctx.throw(602, 'mememe');
        const re = await ctx.remoterRpcRouter('gateway', 'admin.topic', 'get.v1.clients', {"params":{},"body":{"a":1}});
        console.log(re);
    }
};