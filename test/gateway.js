const log4j2 = require('log4j2-node');

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
    }
};
const {start, getThrift, AbstractSqlBean, basicSendMail} = require('../index');
(async function () {
    await start(serviceConfig);
    console.log( await basicSendMail({to:'821561230@qq.com',subject: '111', body:'111111'}));
})()

