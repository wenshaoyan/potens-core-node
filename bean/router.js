/**
 * Created by yanshaowen on 2018/4/11.
 */
'use strict';
const {getRouterType} = require('../util/sys-util');
const path = require('path');
let coreLog;
class Router{
    constructor(pathList, routerDir, _coreLog, defaultConfig) {
        this._pathList = pathList;
        this._routerDir = routerDir;
        this._defaultConfig = defaultConfig;
        this._routerConfig = {};
        this._routerController = {};
        this._routerValidator = {};
        this._routerKeys = {};
        if (!coreLog) coreLog = _coreLog;
        this.setFileList();
    }

    get pathList() {
        return this._pathList;
    }

    set pathList(value) {
        this._pathList = value;
        this.setFileList();
    }


    get routerDir() {
        return this._routerDir;
    }

    set routerDir(value) {
        this._routerDir = value;
    }

    get defaultConfig() {
        return this._defaultConfig;
    }

    set defaultConfig(value) {
        this._defaultConfig = value;
    }

    get routerConfig() {
        return this._routerConfig;
    }

    set routerConfig(value) {
        this._routerConfig = value;
    }

    get routerController() {
        return this._routerController;
    }

    set routerController(value) {
        this._routerController = value;
    }

    get routerValidator() {
        return this._routerValidator;
    }

    set routerValidator(value) {
        this._routerValidator = value;
    }

    get routerKeys() {
        return this._routerKeys;
    }

    set routerKeys(value) {
        this._routerKeys = value;
    }

    /**
     * 提取出router下的所有js或json 并检查文件 生成routerKeys
     */
    setFileList() {
        for (const file of this.pathList) {
            const re = getRouterType(file);
            if ('message' in re) {
                coreLog.warn(re.message);
                continue;
            }
            const routerName = path.basename(path.dirname(file));
            const packageName = `${this.routerDir}.${routerName}`;


            let router;
            switch (re.type) {
                case 'config':
                    router = this.routerConfig;
                    break;
                case 'controller':
                    router = this.routerController;
                    break;
                case 'validator':
                    router = this.routerValidator;
                    break;
                default:
                    continue;
            }
            if (routerName in router) {
                coreLog.error(`${routerName} is exist file=${router[packageName][re.type].s}`);
            } else {
                router[routerName] ={o: require(file), s: file, _packageName: packageName};
            }
        }
        // 检查config中配置  如果对应controller不存在 则忽略该条配置。如果对应的validator不存在 则不进行参数验证
        Object.keys(this.routerConfig).forEach(routerName => {
            const current = this.routerConfig[routerName];
            current.o.config.forEach(v => {
                let controllerObject;
                let validatorObject;
                if (!v.routerKey || !v.controller) {
                    coreLog.warn(`config skip! because ${current['_packageName']}.config='${JSON.stringify(v)}' routerKey or controller is null or undefined`)
                } else if (!(v.controller in (controllerObject = this.routerController[routerName].o))) {
                    coreLog.warn(`config skip! because ${current['_packageName']}.config='${JSON.stringify(v)}' not found corresponding controller`);
                } else if (v.validator && !(v.validator in (validatorObject = this.routerValidator[routerName].o))) {
                    coreLog.warn(`config skip! because ${current['_packageName']}.config='${JSON.stringify(v)}' validator is exist,but not found corresponding validator`);
                } else {
                    if (v.ex === undefined) v.ex = this.defaultConfig.ex;
                    if (v.sync === undefined) v.sync = this.defaultConfig.sync;
                    if (!(v.ex in this.routerKeys))  this.routerKeys[v.ex] = {};
                    if (v.routerKey in this.routerKeys[v.ex]) {
                        coreLog.warn(`config skip! because ${current['_packageName']}.config='${JSON.stringify(v)}' ex=${v.ex} routerKey is exist.`)
                    } else {
                        v['queueName'] = `${routerName}.${v.controller}`;
                        const currentBody = {
                            config: v,
                            controller: controllerObject[v.controller],
                        };
                        if (v.validator) currentBody['validator'] = validatorObject[v.validator];
                        this.routerKeys[v.ex][v.routerKey] = currentBody;
                    }


                }
            })
        });

        ///console.log(this.routerController)







    }





}
module.exports = Router;