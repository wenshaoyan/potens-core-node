/**
 * Created by wenshao on 2018/1/27.
 */
'use strict';

const formatQuery = require('./middleware/format-query');
const AbstractSqlBean = require('./bean/AbstractSqlBean');
const ThriftHelper = require('./helper/thrift-helper');
const connectZkHelper = require('./helper/connect-zk-helper');
const {CuratorFrameworkFactory} = require('zk-curator');
const response = require('./middleware/response');
const routerLog = require('./middleware/router_log');



const getThrift = function (name) {
    return thriftServerMap.get(name);
};


const thriftServerMap = new Map();


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
    if (!option.thriftGlobal || typeof option.thriftGlobal !== 'object') {
        throw new Error('options.thriftGlobal error');
    }
    if (!option.thrift || typeof option.thrift !== 'object') {
        option.thrift = {};
    }
    for (const key in option.thrift) {
        option.thrift[key] = Object.assign(option.thrift[key], option.thriftGlobal);
    }
};

/**
 * 连接zk 并创建thrift连接
 * @param options
 * @param client
 * @return {Promise<void>}
 */
async function startZK(options, client) {

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
            if (options.core_log) options.core_log.error(e);
        }
    }
    try {
        if (options.zk.register instanceof Array) {
            for (let v of options.zk.register) {
                v.path = v.path.replace(/^\//, '');
                const path = await client.create()
                .withMode(CuratorFrameworkFactory.EPHEMERAL)
                .creatingParentContainersIfNeeded()
                .isAbsoluteAddress()
                .forPath(v.path + '/' + v.id, v.data);
            }
        }

    } catch (e) {
        if (options.core_log) options.core_log.error(e);
        process.exit();
    }

}

/**
 * 启动web
 * @param options
 */
const startWeb = (options) => {
    const koa = require('./web/koa-web');
    if (options.web && options.web.app && options.web.port) {
        koa.start(options.web.app, options.web.port);
    }

};

const start = (options, callback) => {
    try {
        checkParams(options);
    } catch (e) {
        if (options.core_log) options.core_log.error(e);
        process.exit();
    }
    const client = CuratorFrameworkFactory.builder()
    .connectString(options.zk.url)
    .build(async function () {
        await startZK(options, client);
        startWeb(options);
        callback();
    });
    client.start();
};

module.exports = {
    formatQuery, AbstractSqlBean, getThrift, start, response, routerLog
};