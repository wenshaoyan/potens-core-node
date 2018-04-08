/**
 * Created by yanshaowen on 2018/02/09
 * 启动微服务相关的操作
 */
const {CuratorFrameworkFactory, TreeCache} = require('zk-curator');
const ThriftHelper = require('../helper/thrift-helper');
const connectZkHelper = require('../helper/connect-zk-helper');
const dict = require('../exception/dict');
const CoreError = require('../exception/core-error');
const systemPath = require('path');
const {JSONParse} = require('./sys-util');
const ZkNodeDateBean = require('../bean/zk-node-data-bean');

const LogDefault = require('./log-default-util');
let coreLogger = new LogDefault();

const getThrift = function (name) {
    return thriftServerMap.get(name);
};
const thriftServerMap = new Map();
let client;


let _basicSendMail;

/**
 * 检查参数 并整理配置
 * @param option
 */
const checkParams = (option) => {
    CoreError.isJson(option, 'option not is json');
    CoreError.isLogger(option.core_log, 'option.core_log not is logger');
    CoreError.isJson(option.zk, 'option.zk not is json');
    CoreError.isStringNotNull(option.zk.url, 'option.zk.url not is json');
    const defaultThrift = {
        "timeout": 10000,
        "poolMax": 10,
        "poolMin": 1,
        "scopeTimeout": [1000, 20000],
        "scopePoolMax": [1, 100],
        "scopePoolMin": [1, 100],
    };
    const thriftConfig = option.thrift;

    if (typeof thriftConfig === 'object') {
        if (thriftConfig.timeout === undefined) thriftConfig.timeout = defaultThrift.timeout;
        CoreError.isNumber(thriftConfig.timeout, 'option.thrift.timeout not is number');
        CoreError.isScope(thriftConfig.timeout, defaultThrift.scopeTimeout, `thriftConfig.timeout need <=${defaultThrift.scopeTimeout[0]} >=${defaultThrift.scopeTimeout[1]}`);

        if (thriftConfig.poolMax === undefined) thriftConfig.poolMax = defaultThrift.poolMax;
        CoreError.isNumber(thriftConfig.poolMax, 'option.thrift.poolMax not is number');
        CoreError.isScope(thriftConfig.poolMax, defaultThrift.scopePoolMax, `option.thrift.poolMax need <=${defaultThrift.scopePoolMax[0]} >=${defaultThrift.scopePoolMax[1]}`);

        if (thriftConfig.poolMin === undefined) thriftConfig.poolMin = defaultThrift.poolMin;
        CoreError.isNumber(thriftConfig.poolMin, 'option.thrift.timeout not is number');
        CoreError.isScope(thriftConfig.poolMin, defaultThrift.scopePoolMin, `option.thrift.poolMin need <=${defaultThrift.scopePoolMin[0]} >=${defaultThrift.scopePoolMin[1]}`);

        if (thriftConfig.log === undefined) thriftConfig.log = new LogDefault();
        CoreError.isLogger(thriftConfig.log, 'option.thrift.log not is logger');

        CoreError.isJson(thriftConfig.tree, 'option.thrift.tree not is json');
        CoreError.isStringNotNull(thriftConfig.rootPath, 'option.thrift.rootPath not is string');

        Object.keys(thriftConfig.tree).forEach(serverName => {
            const server = thriftConfig.tree[serverName];
            const currentErrorString = `option.thrift.tree[${serverName}]`;
            CoreError.isObject(server.object, `currentErrorString.object not is object`);

            if (server.timeout === undefined) server.timeout = thriftConfig.timeout;
            else {
                CoreError.isNumber(server.timeout, `${currentErrorString}.timeout not is number`);
                CoreError.isScope(server.timeout, defaultThrift.scopeTimeout, `${currentErrorString}.timeout need <=${defaultThrift.scopeTimeout[0]} >=${defaultThrift.scopeTimeout[1]}`);
            }

            if (server.poolMax === undefined) server.poolMax = thriftConfig.poolMax;
            else {
                CoreError.isNumber(server.poolMax, `${currentErrorString}.poolMax not is number`);
                CoreError.isScope(server.poolMax, defaultThrift.scopePoolMax, `${currentErrorString}.poolMax need <=${defaultThrift.scopePoolMax[0]} >=${defaultThrift.scopePoolMax[1]}`);
            }

            if (server.poolMin === undefined) server.poolMin = thriftConfig.poolMin;
            else {
                CoreError.isNumber(server.poolMin, `${currentErrorString}.poolMin not is number`);
                CoreError.isScope(server.poolMin, defaultThrift.scopePoolMin, `${currentErrorString}.poolMin need <=${defaultThrift.scopePoolMin[0]} >=${defaultThrift.scopePoolMin[1]}`);
            }
            if (server.log === undefined) server.log = thriftConfig.log;
            else CoreError.isLogger(server.log, `${currentErrorString}.log not is logger`);

        })
    } else {
        option.thrift = {};
    }


};


/**
 * 检查mail message的格式
 * @param message
 */
const checkMailMessage = (message) => {
    if (typeof message !== 'object') {
        return 'message not is object';
    }
    if (typeof message.to !== 'string') {
        return `message.to=${message.to} not is string`;
    }
    if (typeof message.subject !== 'string') {
        return `message.subject=${message.subject} not is string`;
    }
    if (typeof message.body !== 'string') {
        return `message.body=${message.body} not is string`;
    }
    if (message.body_type === undefined) message.body_type = 'text';
    if (typeof message.body_type !== 'string') {
        return `message.body_type=${message.body_type} not is string`;
    }
    if (message.body_type !== 'html' || message.body_type !== 'text') {
        message.body_type = 'text';
    }
    if (message.level === undefined) message.level = 'info';
    if (typeof message.level !== 'string') {
        return `message.level=${message.level} not is string`;
    }
    if (message.level !== 'info'
        ||
        message.level !== 'ware'
        ||
        message.level !== 'error'
        ||
        message.level !== 'fatal'
    ) {
        message.level = 'info';
    }
    return false;
};

/**
 * 连接zk 并创建thrift连接
 * @param options
 * @param client
 * @return {Promise<void>}
 */
async function startZK(options, client) {
    coreLogger = options.core_log;
    for (let key in options.thrift) {
        try {
            const value = options.thrift[key];
            const name = key;
            let parentPath = value.path;
            const connectZk = new connectZkHelper(parentPath, client, value.log, name);
            const address = await connectZk.getServer();    // 获取连接dal的地址
            const pool = {
                min: 1,
                max: 5
            };
            if (value.poolMax && typeof value.poolMax === 'number') {
                pool.max = value.poolMax;
            }
            if (value.poolMin && typeof value.poolMin === 'number') {
                pool.min = value.poolMin;
            }
            // 创建thrift的连接
            let myServer = await new ThriftHelper()
            .setName(name)
            .setLogger(value.log)
            .setServer(value.object)
            .setPoolNumber(pool.min, pool.max)
            .setAddress(address.data);
            // 监听连接的变化 并修改
            connectZk.setServer(myServer);
            thriftServerMap.set(name, myServer);

        } catch (e) {
            coreLogger.error(e);
        }
    }
    try {
        if (options.zk.register instanceof Array) {
            for (let v of options.zk.register) {
                // v.path = v.path.replace(/^\//, '');
                const state = await client.checkExists()
                .unwantedNamespace()
                .forPath(v.path);
                if (!state) {   // path不存在
                    const e = dict.getExceptionByType('start-zk');
                    throw e;
                }

                if (typeof v.data === 'object') v.data = JSON.stringify(v.data);
                const path = await client.create()
                .withMode(CuratorFrameworkFactory.EPHEMERAL)
                .unwantedNamespace()
                .isAbsoluteAddress()
                .forPath(v.path + '/' + v.id, v.data);
            }
        }

    } catch (e) {
        coreLogger.error(e);
        process.exit();
    }
}

// 从json中随机获取一个对象
const randomGetNode = function (o) {
    const arr = Object.keys(o);
    if (arr.length === 0) {
        return null;
    }
    const key = Math.floor((Math.random() * arr.length));
    return o[arr[key]];
};
// 检查zk上节点的正确性 并返回消费节点
const checkParamAndGetConsumeNodeData = function (serverZk, serverName) {
    if (serverZk.children.length > 0) {    // 对应的服务下存在消费节点
        const consumeNode = randomGetNode(serverZk.childrenData);   // 随机获取一个消费节点
        if (!consumeNode) {
            coreLogger.warn(`path=${serverZk.path} not found consume node`);
            return false
        }
        const consumeNodeData = JSONParse(consumeNode.data);
        if (!consumeNodeData) {
            coreLogger.warn(`path=${consumeNode.path} data=${consumeNode.data} data not is json string`);
            return false
        }
        const zkNodeDateBean = new ZkNodeDateBean(consumeNodeData);
        if (zkNodeDateBean.check() !== true) {
            coreLogger.warn(`path=${consumeNode.path} data=${consumeNode.data} check error`);
            return false;
        }
        coreLogger.debug(`thriftName=${serverName};node.id=${consumeNode.id} start connect...`);
        consumeNode.tag = 1;
        return zkNodeDateBean;
    } else {
        coreLogger.warn(`path=${serverZk.path} not found consume node`);
        return false;
    }
};

async function startZKByCache(option, client) {
    coreLogger = option.core_log;
    if (!option.thrift.rootPath) {
        return;
    }
    coreLogger.info(option.thrift.rootPath);
    const treeCache = new TreeCache(client, option.thrift.rootPath, 3);
    treeCache.addListener({
        childAdd: function (cache, deep, changeNode) {
            if (deep === 1) {   // 新增了消费节点
                const cacheDate = cache.getData();
                const serverName = systemPath.basename(systemPath.dirname(changeNode.path));
                const myServer = thriftServerMap.get(serverName);
                if (!myServer) {
                    return;
                }
                if (myServer.connectionStatus !== 1) {  // 当前服务的节点处于非连接中,需要重连。否则不处理
                    const serverZk = cacheDate.childrenData[serverName];
                    const zkNodeDateBean = checkParamAndGetConsumeNodeData(serverZk, serverName);
                    if (zkNodeDateBean) {
                        myServer.setAddress(zkNodeDateBean.host);
                    }
                }


            }
        },
        childRemove: function (cache, deep, changeNode) {
            if (deep === 1 && changeNode.tag === 1) {   // 当前消费的节点断开了 寻找下一个消费节点
                const cacheDate = cache.getData();
                const serverName = systemPath.basename(systemPath.dirname(changeNode.path));
                coreLogger.debug(`thriftName=${serverName};node.id=${changeNode.id} disconnect...`);
                const myServer = thriftServerMap.get(serverName);
                if (!myServer) {
                    coreLogger.warn(`thriftServerMap not found ${serverName}`);
                    return;
                }
                myServer.close();
                const serverZk = cacheDate.childrenData[serverName];
                const zkNodeDateBean = checkParamAndGetConsumeNodeData(serverZk, serverName);
                if (zkNodeDateBean) {
                    myServer.setAddress(zkNodeDateBean.host);
                }
            }
        },
        nodeDataChange: function (cache, deep, changeNode) {

        }
    });
    await treeCache.start();
    const cacheDate = treeCache.getData();

    const thriftConfig = option.thrift;
    for (const serverName of Object.keys(thriftConfig.tree)) {
        const server = thriftConfig.tree[serverName];
        // 创建空的ThriftHelp对象
        let myServer = new ThriftHelper()
        .setName(serverName)
        .setLogger(server.log)
        .setServer(server.object)
        .setPoolNumber(server.poolMin, server.poolMax);
        thriftServerMap.set(serverName, myServer);
        if (serverName in cacheDate.childrenData) { // 在zookeeper中注册了对应的服务
            const serverZk = cacheDate.childrenData[serverName];
            const zkNodeDateBean = checkParamAndGetConsumeNodeData(serverZk, serverName);
            if (zkNodeDateBean) {
                myServer.setAddress(zkNodeDateBean.host);
            }

        } else {
            coreLogger.warn(`zk=${option.thrift.rootPath} not found child=${serverName}`);
        }
    }


}

/**
 * 启动web
 * @param options
 */
const startWeb = (options) => {
    const koa = require('../web/koa-web');
    if (options.web && options.web.app && options.web.port) {
        koa.start(options.web.app, options.web.port);
    }

};
/**
 * 启动异步mq
 * @param option
 */
const startAMQ = (option) => {
    const amqConfig = option.amq;
    coreLogger = option.core_log;
    if (typeof amqConfig === 'object') {
        Object.keys(amqConfig).forEach(mqName => {
            const mq = amqConfig[mqName];
            if (mq.type === undefined) mq.type = 'kafka';
            if (mq.type === 'kafka' && mqName === 'mail') {
                const kafka = require('kafka-node'),
                    Producer = kafka.Producer,
                    client = new kafka.KafkaClient({kafkaHost: mq.host}),
                    producer = new Producer(client);
                _basicSendMail = function (message) {
                    const checkResult = checkMailMessage(message);
                    if (checkResult) {
                        coreLogger.error(checkResult);
                        return false
                    }
                    return new Promise((resolve, reject) => {
                        producer.send([{
                            topic: mq.topic,
                            messages: JSON.stringify(message),
                            key: 'test'
                        }], (err, data) => {
                            if (err) reject(err);
                            else resolve(data);
                        })
                    });
                };
            }

        })

    }


};
const basicSendMail = async function (message) {
    if (typeof _basicSendMail !==  'function') {
        coreLogger.error(`_basicSendMail not is Function, pls check the config.amq.mail config,so message not send`);
    }else{
        return await _basicSendMail(message);
    }
};


/**
 * 启动服务
 * @param options
 * @param callback
 */
const start = (options, callback) => {
    checkParams(options);
    if (callback === undefined) {
        return new Promise((resolve, reject) => {
            client = CuratorFrameworkFactory.builder()
            .connectString(options.zk.url)
            .build(async function () {
                try {
                    // await startZK(options, client);
                    await startZKByCache(options, client);
                    startWeb(options);
                    startAMQ(options);

                    resolve();
                } catch (e) {
                    reject(e);
                }
            });
            client.start();
        })
    } else {
        client = CuratorFrameworkFactory.builder()
        .connectString(options.zk.url)
        .build(async function () {
            try {
                // await startZK(options, client);
                await startZKByCache(options, client);
                startWeb(options);
                startAMQ(options);
                callback();
            } catch (e) {
                callback(e);
            }
        });
        client.start();
    }

};
/**
 * 退出
 */
const exit = () => {
    client.close();
};

module.exports = {
    getThrift, start, exit, basicSendMail
};