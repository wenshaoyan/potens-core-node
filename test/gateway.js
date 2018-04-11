const log4j2 = require('log4j2-node');
const path = require('path');

log4j2.configure(
    {
        "appenders": {
            "console": {"type": "console"}
        },
        "categories": {
            "default": {"appenders": ["console"], "level": "trace"}
        }
    }
);
const serviceConfig = {
    "project_dir": path.resolve(__dirname, '..'),
    "node_env": "develop",
    "core_log": log4j2.getLogger('core'),
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
                "vhost": "/gateway"
            },
            "admin_service": {
                "protocol": "amqp",
                "hostname": "120.92.108.221",
                "port": "5672",
                "username": "admin-project",
                "password": "314106",
                "vhost": "/service/admin"
            }
        },
        "routers": [
            {
                "mq_name": "gateway",
                "router_dir": "test.router",
            }
        ]

    }
};
const {start, getThrift, AbstractSqlBean, basicSendMail, AmqpHelper} = require('../index');
(async function () {
    try {
        await start(serviceConfig);
        // await basicSendMail({to: '821561230@qq.com', subject: '111', body: '111111'});
        AmqpHelper.getConnect('gateway').pubTopic("get.v1.a.b", {a:1});
    }catch (e){
        console.log(e);
    }
})();

