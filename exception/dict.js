/**
 * Created by wenshao on 2018/03/01.
 * 异常字典类
 */
'use strict';
const CoreException = require('./core-exception');
const data = {
    "start-zk": {
        "code": 1,
        "type": "start-zk",
        "message": "启动时zk检查报错",
        "fullMessage": "启动时zk检查报错",
    },
    "unknown": {
        "code": 100,
        "type": "unknown",
        "message": "未知异常",
        "fullMessage": "未知异常"
    }
};
for (const o in data) {
    data[o]['serverName'] = 'thrift-node-core';
    data[o]['fullMessage'] = data[o]['message'];
}
const getJsonByType = function (type) {
    if (!(type in data)) type = 'unknown';
    return JSON.parse(JSON.stringify(data[type]));
};
const getExceptionByType = function (type) {
    return new CoreException(getJsonByType(type));
};
module.exports = {getJsonByType, getExceptionByType};