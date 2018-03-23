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
    "thrift": {
        "timeout": 10000,
        "poolMax": 2,
        "poolMin": 1,
        "log":log4j2.getLogger('thrift'),
        "tree": {
            "rootPath": "/develop/thrift",
            "nodes": {
                "UserService": {
                    "object": require('./gen/UserService')
                },
                "BannerService": {
                    "object": require('./gen/UserService')
                }
            }
        }
    },
    "web": {
        "http": 9000,
        "app": require('./app')
    },
    "amq": {
        "host": '120.92.108.221:9092',
        "mail": {
            "topic": "mail"
        }
    }
};
const {start, getThrift, AbstractSqlBean, basicSendMail} = require('../index');
start(serviceConfig, main);

async function main() {
    console.log('===========2')
    //console.log(await basicSendMail({to:'11'}));



}