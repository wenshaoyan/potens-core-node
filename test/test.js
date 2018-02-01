const log4js = require('log4js');
log4js.configure(
    {
        "appenders": {
            "console":{"type":"console"},
            "http":{
                "type": "logFaces-HTTP",
                "url": "http://120.92.108.221:7000/AdminHttp/develop/123456789"
            }
        },
        "categories": {
            "default": { "appenders": ["console"], "level":"trace" },
            "router":{"appenders":["console","http"],"level":"trace"},
            "zookeeper":{"appenders":["console","http"],"level":"trace"},
            "thrift":{"appenders":["console","http"],"level":"trace"},
            "resSuccess":{"appenders":["console"],"level":"trace"},
            "resFail":{"appenders":["console","http"],"level":"trace"},
            "resUnknown":{"appenders":["console","http"],"level":"trace"},
            "error": {"appenders":["console","http"],"level":"trace"},
            "core": {"appenders":["console","http"],"level":"trace"}
        }
    }
);

const serviceConfig = {
    "node_env": "develop",
    "core_log": log4js.getLogger('core'),
    "zk": {
        "url": process.env.ZK_URL,
        "registerPath": ["/develop/http/admin", "/develop-1.0.0/http/amin" ],
        "registerId": "127.0.0.1:90",
        "registerData": "111"
    },
    "thriftGlobal": {
        "timeout": 10000,
        "poolMax": 2,
        "poolMin": 1,
        "log":log4js.getLogger('thrift')
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
const {start, getThrift} = require('../index');
start(serviceConfig, main);
function main() {
    log4js.getLogger().info('==============')
}