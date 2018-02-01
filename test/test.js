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
            "path": "/thrift/develop/UserService",
            "object": require('../gen-nodejs/UserService')
        },
        "BannerService": {
            "path": "/thrift/develop/BannerService",
            "object": require('../gen-nodejs/BannerService')
        },
        "ClientService": {
            "path": "/thrift/develop/ClientService",
            "object": require('../gen-nodejs/ClientService')
        },
        "CourseService": {
            "path": "/thrift/develop/CourseService",
            "object": require('../gen-nodejs/CourseService')
        },
        "CommonService": {
            "path": "/thrift/develop/CommonService",
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
start(serviceConfig, main);
function main() {
    console.log('==============')
}