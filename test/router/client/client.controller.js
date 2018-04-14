module.exports = {
    clients: (ctx)=> {
        ctx.body = [{
            client_id: 1,
            client_name: 'pc'
        }];
    }
};