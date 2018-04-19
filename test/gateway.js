const log4j2 = require('log4j2-node');
const path = require('path');

log4j2.configure(
    {
        "appenders": {
            "console": {"type": "console","layout": {type:"detail"}}
        },
        "categories": {
            "default": {"appenders": ["console"], "level": "trace"}
        }
    }
);
const logger = log4j2.getLogger('core');
const serviceConfig = {
    "project_dir": path.resolve(__dirname, '..'),
    "node_env": "develop",
    "core_log": logger,
    "server_name": "gateway",
    "service_id": "1.0.0.0",
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
        "connects": {
            "gateway": {
                "protocol": "amqp",
                "hostname": "120.92.108.221",
                "port": "5672",
                "username": "admin-project",
                "password": "314106",
                "vhost": "/gateway",
            },
            "admin_service": {
                "protocol": "amqp",
                "hostname": "120.92.108.221",
                "port": "5672",
                "username": "admin-project",
                "password": "314106",
                "vhost": "/service/admin",
                "consume_config": {
                    "router_dir": "test.router",
                    "default_ex": "amq.topic",
                }
            }
        }
    }
};
const {Application} = require('../index');
(async function () {
    try {
        await Application.start(serviceConfig);
    }catch (e){
        logger.error(e);
    }
})();



process.on('exit',function(code){
    exit(); // 释放连接
    logger.error(code);

});
process.on('uncaughtException',function(){
    process.exit(1000);
});
process.on('SIGINT',function () {
    process.exit(1001);
});
process.on('SIGTERM',function () {
    process.exit(1002);
});


