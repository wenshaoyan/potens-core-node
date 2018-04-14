module.exports = {
    users: (ctx)=> {
        ctx.body = [{
            user_id: 1,
            user_name: 'admin'
        }];
    }


};