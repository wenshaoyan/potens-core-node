/**
 * Created by yanshaowen on 2018/02/09
 * 启动微服务相关的操作
 */
const {CuratorFrameworkFactory, TreeCache} = require('zk-curator');
const ThriftHelper = require('../helper/thrift-helper');
const dict = require('../exception/dict');
const CoreError = require('../exception/core-error');
const systemPath = require('path');
const {JSONParse, findFileListByPackage} = require('./sys-util');
const ZkNodeDateBean = require('../bean/zk-node-data-bean');
const AmqpHelper = require('../helper/amqp-helper');
const LogDefault = require('./log-default-util');
let coreLogger = new LogDefault();

const PotensX = require('../potens-x');
const getThrift = function (name) {
    return thriftServerMap.get(name);
};
const thriftServerMap = new Map();
let client;

let getLogger = LogDefault.getLogger;
let _basicSendMail;


/**
 * 检查参数 并整理配置
 * @param option
 */
const checkParams = (option) => {
    CoreError.isJson(option, 'option not is json');


    CoreError.isJson(option.zk, 'option.zk not is json');
    CoreError.isStringNotNull(option.zk.url, 'option.zk.url not is json');
    CoreError.isStringNotNull(option.project_dir, 'option.project_dir not is string');
    CoreError.isStringNotNull(option.server_name, 'option.server_name not is string');
    CoreError.isStringNotNull(option.service_id, 'option.service_id not is string');
    // 加载log4j2的日志配置
    if (option.log_package === undefined) option.log_package = 'config';

    const fileResult = findFileListByPackage(option.project_dir, option.log_package, 'log4j2', ['js', 'json']);
    if (fileResult.data.length === 0) {
        console.warn(`not find log config: path=${fileResult.path}`);
    } else {
        const logModule = require('log4j2-node');
        logModule.configure(require(fileResult.data[0]));
        getLogger = logModule.getLogger;
        coreLogger = logModule.getLogger('core');
    }
    PotensX.set('core_log', coreLogger);
    PotensX.set('project_dir', option.project_dir);
    PotensX.set('server_name', option.server_name);
    PotensX.set('service_id', option.service_id);
    PotensX.set('getLogger', getLogger);


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
    if (!option.thrift.rootPath) {
        return false;
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
    return true;


}

/**
 * 启动web
 * @param options
 */
const startWeb = (options) => {
    const koa = require('../web/koa-web');
    if (options.web && options.web.app && options.web.port) {
        koa.start(options.web.app, options.web.port);
        return true;
    }
    return false;

};
/**
 * 启动异步mq
 * @param option
 */
const startAMQ = (option) => {
    const amqConfig = option.amq;
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

        });
        return true;
    }
    return false;
};
// 连接rabbitmq
const startRabbitMq = async function (option) {
    if (typeof option.rabbitmq === 'object') {
        await AmqpHelper.start(option.rabbitmq);
        return true;
    }
    return false;
};

const basicSendMail = async function (message) {
    if (typeof _basicSendMail !== 'function') {
        coreLogger.error(`_basicSendMail not is Function, pls check the config.amq.mail config,so message not send`);
    } else {
        return await _basicSendMail(message);
    }
};


/**
 * 启动服务
 * @param options
 */
const start = async(options) => {
    const SCP_TIME = new Date().getTime();
    checkParams(options);
    const ECP_TIME = new Date().getTime();
    coreLogger.info(`checkParams complete,consumption time ${ECP_TIME - SCP_TIME}ms`);

    const SCZ_TIME = new Date().getTime();
    client = await CuratorFrameworkFactory.builder()
        .connectString(options.zk.url)
        .build()
        .start();
    const ECZ_TIME = new Date().getTime();
    coreLogger.info(`connectZookeeper complete,consumption time ${ECZ_TIME - SCZ_TIME}ms`);

    const SZC_TIME = new Date().getTime();
    const IS_ZC = await startZKByCache(options, client);
    const EZC_TIME = new Date().getTime();
    if (IS_ZC) coreLogger.info(`startZKByCache complete,consumption time ${EZC_TIME - SZC_TIME}ms`);

    const SW_TIME = new Date().getTime();
    const IS_W = startWeb(options);
    const EW_TIME = new Date().getTime();
    if (IS_W) coreLogger.info(`startWeb complete,consumption time ${EW_TIME - SW_TIME}ms`);


    const SK_TIME = new Date().getTime();
    const IS_K = startAMQ(options);
    const EK_TIME = new Date().getTime();
    if (IS_K) coreLogger.info(`startAMQ complete,consumption time ${EK_TIME - SK_TIME}ms`);


    const SRM_TIME = new Date().getTime();
    const IS_RM = await startRabbitMq(options);
    const ERM_TIME = new Date().getTime();
    if (IS_RM) coreLogger.info(`startRabbitMq complete,consumption time ${ERM_TIME - SRM_TIME}ms`);


};
/**
 * 退出
 */
const exit = () => {
    client.close();
    const amqpMap = AmqpHelper.getAllConnectMap();

    for (const conn of amqpMap) {
        conn[1].close();
    }


};

module.exports = {
    getThrift, start, exit, basicSendMail, AmqpHelper
};