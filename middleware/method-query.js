/**
 * Created by wenshao on 2018/2/4.
 * 业务层查询
 */
'use strict';
let methods = {};
let {getThrift} = require('../index');
let {loadDirFiles} = require('../util/sys-util');
const moduleName = 'method=query';
/**
 * 创建任务
 * @param root      当前字段的上级对象 第一级为{}
 * @param fields    字段集合
 * @param ctx
 */
async function createTask(root, fields, ctx) {
    const resultData = {};
    const list = [];
    const listMap = new Map();
    let i = 0;
    for (const name in fields) {
        listMap.set(i, name);
        list.push(execTask(fields[name], name, root, ctx));
        i++;
    }
    const result = await Promise.all(list);
    for (const j in result) {
        resultData[listMap.get(+j)] = result[j];
    }
    return resultData;
}

/**
 * 执行任务
 * @param field     field为对应到的method中的对象
 * @param name      field的名称
 * @param root      当前字段的上级对象 第一级为{}
 * @param ctx
 * @return {Promise<*>}
 */
async function execTask(field, name, root, ctx) {
    let args = {};
    if (!methods[field.method]) {
        throw new Error(`${moduleName}:${field.method} not found`);
    }
    const currentmethod = methods[field.method];
    if (currentmethod.args) {
        for (const k in currentmethod.args) {
            args[k] = null;
        }
    }
    if (field.args) { // 有参数
        args = field.args;
    }
    const extend = {thrift: {}, http: {}};
    if (typeof currentmethod === 'string') {
        const v = currentmethod.thrift;
        if (!getThrift(v)) {
            throw new Error(`${moduleName}:${v} not in thrift`);
        }
        extend.thrift[v] = getThrift(v).getProxyClient();
    } else if (currentmethod.thrift instanceof Array) {
        for (const v of currentmethod.thrift) {
            if (!getThrift(v)) {
                throw new Error(`${moduleName}:${v} not in thrift`);
            }
            extend.thrift[v] = await getThrift(v).getProxyClient();
        }
    }
    const newRoot = await currentmethod.resolve(root, args, extend, ctx);

    for (const parent of newRoot) {
        if (field.fields) {
            const children = await createTask(parent, field.fields, ctx);
            for (const childrenKey in children) {
                parent[childrenKey] = children[childrenKey];
            }
        }
    }
    return newRoot;
}
function methodQuery(opt) {
    let jsonKey = 'methodJson';
    let graphqlKey = 'methodGraphql';
    const methods = {};
    if (typeof opt === 'object') {
        if (typeof opt.jsonKey === 'string') {
            jsonKey = opt.jsonKey;
        }
        if (typeof opt.graphqlKey === 'string') {
            graphqlKey = opt.graphqlKey;
        }
        if (typeof opt.methodDir === 'string') {
            const dirList = loadDirFiles(opt.methodDir);
            for (const file of dirList) {
                const fileObject = require(file);
                for (const name in fileObject) {
                    if (name in methods) {
                        throw new Error(`${moduleName}:${name} is repeat, ${name}`);
                    } else {
                        methods[name] = fileObject[name];
                    }
                }
            }
        } else {
            throw new Error(`${moduleName}:opt.methodDir error,${opt.methodDir}`);
        }
    } else {
        throw new Error(`${moduleName}:opt error,${opt}`);
    }
    return async function (ctx, next) {
        if (typeof ctx[graphqlKey] === 'string') {   // 将methodGraphql转为methodJson

        }
        if (typeof ctx[jsonKey] === 'object') {  // 用methodJson去method中查询
            ctx.body = await createTask({}, ctx[jsonKey], ctx);
        }
        await next();
    }
}
module.exports = methodQuery;
