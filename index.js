/**
 * Created by wenshao on 2018/1/27.
 */
'use strict';

const formatQuery = require('./middleware/format-query');
const AbstractSqlBean = require('./bean/AbstractSqlBean');
const ThriftHelper = require('./helper/thrift-helper');
const connectZkHelper = require('./helper/connect-zk-helper');
const {CuratorFrameworkFactory} = require('zk-curator');
const thriftServerMap = new Map();

const getThrift = function (name) {
    return thriftServerMap.get(name);
};
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
    if (!option.zk.registerPath || typeof option.zk.registerPath !== 'string') {
        throw new Error('options.zk.registerPath error');
    }
    if (!option.zk.registerId || typeof option.zk.registerId !== 'string') {
        throw new Error('options.zk.registerId error');
    }
    if (!option.zk.registerData || typeof option.zk.registerData !== 'string') {
        throw new Error('options.zk.registerData error');
    }
    if (!option.thriftGlobal || typeof option.thriftGlobal !== 'object') {
        throw new Error('options.thriftGlobal error');
    }
    if (!option.port || typeof option.port !== 'object') {
        throw new Error('options.port error');
    }
    if (!option.thrift || typeof option.thrift !== 'object') {
        option.thrift = {};
    }
    for (const key in option.thrift) {
        option.thrift[key] = Object.assign(option.thrift[key], option.thriftGlobal);
    }
};
async function main(options, client) {
    try {
        checkParams(options);
    } catch (e) {
        console.log(e);
        process.exit();
    }
    for (let key in options.thrift) {
        try {
            const value = options.thrift[key];
            const name = key;
            let parentPath = value.path;
            const connectZk = new connectZkHelper(parentPath, client);
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
            .setLogger(value.log)
            .setServer(value.object)
            .setAddress(address.data)
            .setPoolNumber(pool.min, pool.max)
            .connect();
            // 监听连接的变化 并修改
            connectZk.setServer(myServer);
            thriftServerMap.set(name, myServer);

            const path = await client.create()
            .withMode(CuratorFrameworkFactory.EPHEMERAL)
            .isAbsoluteAddress()
            .forPath(options.zk.registerId, options.zk.registerData);
        } catch (e) {
            console.log(e)
        }

    }
}
const start = (options, callback) => {
    const client = CuratorFrameworkFactory.builder()
    .connectString(options.zk.url)
    .namespace(options.zk.registerPath)
    .build(async function () {
        main(options, client);
        callback();
    });
    client.start();
};

module.exports = {
    formatQuery, AbstractSqlBean, getThrift, start
};

