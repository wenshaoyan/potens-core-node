const serviceConfig = {
    "zk": {
        "url": process.env.ZK_URL,
        "registerPath": "http/admin",
        "registerId": "127.0.0.1:90",
        "registerData": "111"
    },
    "thriftGlobal": {
        "timeout": 10000,
        "poolMax": 2,
        "poolMin": 1,
        "log":console
    },
    "thrift": {
        "UserService": {
            "path": "/dal/develop/UserService",
            "object": require('../gen-nodejs/UserService')
        },
        "BannerService": {
            "path": "/dal/develop/BannerService",
            "object": require('../gen-nodejs/BannerService')
        },
        "ClientService": {
            "path": "/dal/develop/ClientService",
            "object": require('../gen-nodejs/ClientService')
        },
        "CourseService": {
            "path": "/dal/develop/CourseService",
            "object": require('../gen-nodejs/CourseService')
        },
        "CommonService": {
            "path": "/dal/develop/CommonService",
            "object": require('../gen-nodejs/CommonService')
        }
    },
    "http": {},
    "port": {
        "http": 9000,
        "thrift": 20000
    }
};
const {start, getThrift} = require('../index');
start(serviceConfig, function () {
   console.info('=========')
});