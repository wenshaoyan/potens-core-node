/**
 * Created by wenshao on 2018/2/4.
 * 业务层查询
 */
'use strict';
let services = {};
let {getThrift} = require('../index');
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
 * @param field     field为对应到的service中的对象
 * @param name      field的名称
 * @param root      当前字段的上级对象 第一级为{}
 * @param ctx
 * @return {Promise<*>}
 */
async function execTask(field, name, root, ctx) {
    let args = {};
    if (!services[field.service]) {
        console.error(field, field.service + ' not found');
        throw new Error(field.service + ' not found');
    }
    const currentService = services[field.service];
    if (currentService.args) {
        for (const k in currentService.args) {
            args[k] = null;
        }
    }
    if (field.args) { // 有参数
        args = field.args;
    }
    const extend = {thrift: {}, http: {}};
    if (typeof currentService === 'string') {
        const v = currentService.thrift;
        if (!getThrift(v)) {
            console.error(`${v} not in thrift `);
            throw new Error(`${v} not in thrift `);
        }
        extend.thrift[v] = getThrift(v).getProxyClient();
    } else if (currentService.thrift instanceof Array) {
        for (const v of currentService.thrift) {
            if (!getThrift(v)) {
                console.error(`${v} not in thrift `);
                throw new Error(`${v} not in thrift `);
            }
            extend.thrift[v] = await getThrift(v).getProxyClient();
        }
    }
    const newRoot = await currentService.resolve(root, args, extend, ctx);

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
function serviceQuery(opt) {
    let jsonKey = 'serviceJson';
    let graphqlKey = 'serviceGraphql';
    if (typeof opt === 'object') {
        if (typeof opt.jsonKey === 'string') {
            jsonKey = opt.jsonKey;
        }
        if (typeof opt.graphqlKey === 'string') {
            graphqlKey = opt.graphqlKey;
        }
    }
    return async function (ctx, next) {
        if (typeof ctx[graphqlKey] === 'string') {   // 将serviceGraphql转为serviceJson

        }
        if (typeof ctx[jsonKey] === 'object') {  // 用serviceJson去service中查询
            ctx.body = await createTask({}, ctx[jsonKey], ctx);
        }
        await next();
    }
}
module.exports = serviceQuery;
