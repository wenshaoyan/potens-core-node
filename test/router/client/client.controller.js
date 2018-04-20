module.exports = {
    clients: (ctx)=> {
        ctx.body = [{
            client_id: 1,
            client_name: 'pc'
        }];
        ctx.throw(600, '没找到用户');
        return new Promise(re =>{
            setTimeout(()=> {
                re();
            },1000)
        })
    }
};