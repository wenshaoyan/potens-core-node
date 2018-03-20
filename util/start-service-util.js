/**
 * Created by yanshaowen on 2018/02/09
 * 启动微服务相关的操作
 */
const {CuratorFrameworkFactory} = require('zk-curator');
const ThriftHelper = require('../helper/thrift-helper');
const connectZkHelper = require('../helper/connect-zk-helper');
const dict = require('../exception/dict');

const LogDefault = require('./log-default-util');
let coreLogger = new LogDefault();

const getThrift = function (name) {
    return thriftServerMap.get(name);
};
const thriftServerMap = new Map();
let client;
let basicMail;
/**
 * 检查参数
 * @param option
 */
const checkParams = (option) => {
    if (!option || typeof option !== 'object') {
        throw new Error('options error');
    }
    if (!option.zk || typeof option.zk !== 'object') {
        throw new Error('options.zk error');
    }
    if (!option.zk.url || typeof option.zk.url !== 'string') {
        throw new Error('options.zk.url error');
    }
    if (typeof option.thriftGlobal !== 'object') {
        throw new Error('options.thriftGlobal error');
    }
    if (!option.thrift || typeof option.thrift !== 'object') {
        option.thrift = {};
    }
    for (const key in option.thrift) {
        option.thrift[key] = Object.assign(option.thrift[key], option.thriftGlobal);
    }
    if (!option.amq || typeof option.amq !== 'object') {
        throw new Error('options.amq error');
    }
    Object.keys(option.amq).map(k => {
        if (k !== 'host') {
            const v = option.amq[k];
            if (typeof v.topic !== 'string') {
                throw new Error(`${v.host} not is string`);
            }
        }

    })
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
    if (typeof message.body_type !== 'string' ) {
        return `message.body_type=${message.body_type} not is string`;
    }
    if (message.body_type !== 'html' ||  message.body_type !== 'text') {
        message.body_type = 'text';
    }
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
                    throw e ;
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
 * @param options
 */
const startAMQ = (options) => {
    const amq = options.amq;
    coreLogger = options.core_log;
    const kafka = require('kafka-node'),
        Producer = kafka.Producer,
        client = new kafka.KafkaClient({kafkaHost:amq.host}),
        producer = new Producer(client);
    basicMail = function (message) {
        if (!amq.mail) {
            coreLogger.error('amq.mail.topic error');
            return false;
        }
        const checkResult = checkMailMessage(message);
        if (checkResult) {
            coreLogger.error(checkResult);
        }
        return new Promise((resolve, reject) => {
            producer.send([{ topic: amq.mail, messages: JSON.stringify(message), key:'test' }], (err,data) => {
                if (err) reject(err);
                else resolve(data);
            })
        });
    };


};
/**
 * 启动服务
 * @param options
 * @param callback
 */
const start = (options, callback) => {
    checkParams(options);
    client = CuratorFrameworkFactory.builder()
    .connectString(options.zk.url)
    .build(async function () {
        await startZK(options, client);
        startWeb(options);
        startAMQ(options);
        callback();
    });
    client.start();
};
/**
 * 退出
 */
const exit = () => {
    client.close();
};

module.exports = {
    getThrift, start, exit, basicMail
};