const log4j2 = require('log4j2-node');

log4j2.configure(
    {
        "appenders": {
            "console": {"type": "console"}
        },
        "categories": {
            "default": {"appenders": ["console"], "level": "trace"},
            "core": {"appenders": ["console"], "level": "trace"}
        }
    }
);

const serviceConfig = {
    "node_env": "develop",
    "core_log": log4j2.getLogger('core'),
    "zk": {     // 必选
        "url": process.env.ZK_URL,
        "register1": [
            {
                "path": "/develop/http/admin",
                "id": "127.0.0.1:9000",
                "data": "111"
            }
        ]
    },
    "web": {
        "http": 9000,
        "app": require('./app')
    },
    "amq": {    // 可选
        "mail": {
            "topic": "basis-mail",
            "host": process.env.KAFKA_URL,
            "type": "kafka"
        }
    }
};
const {start, getThrift} = require('../index');
start(serviceConfig, main);

async function main() {

    // console.log(await basicSendMail({to:'821561230@qq.com',subject: '111', body:'111111'}));

}