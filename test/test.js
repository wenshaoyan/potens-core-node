const { CuratorFrameworkFactory } = require('zk-curator');
const { ThriftHelper, connectZkHelper } = require('../index');
const os = require('os');
let client;
client = CuratorFrameworkFactory.builder()
.connectString(process.env.ZK_URL)
.namespace(`http`)
.build(main);
client.start();
//global.myUserServer = null;
let preNodeList = null;
const serviceConfig = {
    "dalName": {
        "user": "UserService",
        "banner": "BannerService",
        "client": "ClientService",
        "course": "CourseService",
        "common": "CommonService"
    },
    "port": 9000
};
const envSet = new Set(['develop', 'production']);

function getEnv() {
    let env = process.env.NODE_ENV;
    if (env && envSet.has(env)) return env;
    return 'develop';
}
const thriftServerMap = new Map();
global.getThriftServer = function (name) {
    return thriftServerMap.get(name);
};
// 获取本地ip
const localIp = (function () {
    const interfaces = os.networkInterfaces();
    for (let devName in interfaces) {
        let iface = interfaces[devName];
        for (let i = 0; i < iface.length; i++) {
            let alias = iface[i];
            if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
                return alias.address;
            }
        }
    }
})();
async function main() {
    try {
        for (let key in serviceConfig.dalName) {
            const name = serviceConfig.dalName[key];
            let parentPath = `/dal/${getEnv()}/${name}`;
            const connectZk = new connectZkHelper(parentPath, client);
            const address = await connectZk.getServer();    // 获取连接dal的地址
            // 创建thrift的连接
            let myServer = await new ThriftHelper()
            .setServer(require(`../gen-nodejs/${name}.js`))
            .setAddress(address.data)
            .setPoolNumber(1, 2)
            .connect();
            // 监听连接的变化 并修改
            connectZk.setServer(myServer);
            thriftServerMap.set(name, myServer);
            const path = await client.create()
            .withMode(CuratorFrameworkFactory.EPHEMERAL)
            .isAbsoluteAddress()
            .forPath(localIp, `${localIp}:${serviceConfig.port}`);
        }


    } catch (e) {
        console.log(e);
        process.exit();

    }
}