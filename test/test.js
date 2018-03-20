const log4j2 = require('log4j2-node');
log4j2.configure(
    {
        "appenders": {
            "console":{"type":"console"}
        },
        "categories": {
            "default": { "appenders": ["console"], "level":"trace" },
            "router":{"appenders":["console"],"level":"trace"},
            "zookeeper":{"appenders":["console"],"level":"trace"},
            "thrift":{"appenders":["console",],"level":"trace"},
            "resSuccess":{"appenders":["console"],"level":"trace"},
            "resFail":{"appenders":["console"],"level":"trace"},
            "resUnknown":{"appenders":["console"],"level":"trace"},
            "error": {"appenders":["console"],"level":"trace"},
            "core": {"appenders":["console"],"level":"trace"}
        }
    }
);

const serviceConfig = {
    "node_env": "develop",
    "core_log": log4j2.getLogger('core'),
    "zk": {
        "url": process.env.ZK_URL,
        "register": [
            {
                "path": "/develop/http/admin",
                "id": "127.0.0.1:9000",
                "data": "111"
            }
        ]
    },
    "thriftGlobal": {
        "timeout": 10000,
        "poolMax": 2,
        "poolMin": 1,
        "log":log4j2.getLogger('thrift')
    },
    "thrift": {
        "UserService": {
            "path": "/develop/thrift/UserService",
            "object": require('./gen/UserService')
        },
        "BannerService": {
            "path": "/develop/thrift/BannerService",
            "object": require('./gen/BannerService')
        },
        "ClientService": {
            "path": "/thrift/develop/ClientService",
            "object": require('./gen/ClientService')
        },
        "CourseService": {
            "path": "/develop/thrift/CourseService",
            "object": require('./gen/CourseService')
        },
        "CommonService": {
            "path": "/develop/thrift/CommonService",
            "object": require('./gen/CommonService')
        }
    },
    "http": {},
    "web": {
        "http": 9000,
        "app": require('./app')
    }
};
const {start, getThrift, AbstractSqlBean} = require('../index');
start(serviceConfig, main);
async function main() {
    log4j2.getLogger().info('==============')
    try{
        let client = await getThrift('CommonService').getProxyClient();
        console.log(await client.topicBankSelect(new AbstractSqlBean({})));

    }catch (e){
        console.log(e)
    }
}