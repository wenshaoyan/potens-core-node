const path = require('path');

const serviceConfig = {
    "project_dir": path.resolve(__dirname, '..'),
    "node_env": "develop",
    "server_name": "gateway",
    "service_id": "1.0.0.0",
    "log_package": "test.config",
    "zk": {     // 必选
        "url": process.env.ZK_URL,
        "register": [
            {
                "path": "/develop/gateway",
                "id": "127.0.0.1:9000",
                "data": "111"
            }
        ]
    },
    "rabbitmq": {
        "consume_config": {
            "router_dir": "test.router",
            "default_ex": "admin.gateway",
        },
        "connects": {
            "gateway": {
                "protocol": "amqp",
                "hostname": "120.92.108.221",
                "port": "5672",
                "username": "gateway",
                "password": "123456",
                "vhost": "/gateway",
                "is_load_consume": true,
                "default_config": {
                    "publish_timeout": 3000,
                    "rpc_reply_timeout": 3000,
                }
            }
        }
    }
};
const {Application,Call} = require('../index');
// const logger = require('log4j2-node').getLogger('core');
(async function () {
    try {
        await Application.start(serviceConfig);
        const amqpHelp = Call.getAmqp('gateway');
        await amqpHelp.pubTopic('admin.gateway', 'get.v1.users', {a:1})


    }catch (e){
        // logger.error(e);
    }
})();



process.on('exit',function(code){
    // exit(); // 释放连接
    // logger.error(code);

});
process.on('uncaughtException',function(err){
    console.log(err)
    process.exit(1000);
});
process.on('SIGINT',function () {
    process.exit(1001);
});
process.on('SIGTERM',function () {
    process.exit(1002);
});


