module.exports = {
    users: (ctx)=> {
        ctx.body = {'a':1};

    },
    hello: (ctx) => {
        return 'world';
    }
};