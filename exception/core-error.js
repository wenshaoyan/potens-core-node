/**
 * Created by wenshao on 2018/03/01.
 * 错误类
 */
'use strict';

class CoreError extends Error {
    constructor(message, code) {
        super();
        this.name = 'CoreError';
        if (typeof code === 'object') {
            const obj = code;
            this.code = obj.code;
            this.message = obj.message;
        } else {
            this.code = code;
            this.message = message;
        }

    }


    // 必须为json对象
    static isJson(o, message) {
        if (typeof o === 'object' && !Array.isArray(o)) {
            return true;
        }
        throw new CoreError(message, 1);
    }

    // 必须为object
    static isObject(o, message) {
        if (typeof o === 'object') {
            return true;
        }
        throw new CoreError(message, 2);
    }

    // 必须为array
    static isArray(o, message) {
        if (Array.isArray(o)) {
            return true;
        }
        throw new CoreError(message, 3);
    }

    // 必须存在key
    static keyExist(o, key, message) {
        if (key in o) {
            return true;
        }
        throw new CoreError(message, 4);
    }
    // 必须为logger对象 包含 info error debug 等方法
    static isLogger(o, message) {
        if (o.info instanceof Function
            &&
            o.error instanceof Function
            &&
            o.debug instanceof Function
        ) {
            return true;
        }
        throw new CoreError(message, 5);
    }
    // 是否为不为空字符串
    static isStringNotNull(o, message) {
        if (typeof o === 'string' && o.length > 0) {
            return true;
        }
        throw new CoreError(message, 6);
    }
    // 是否为number
    static isNumber(o, message) {
        if (typeof o === 'number') {
            return true;
        }
        throw new CoreError(message, 7);
    }
    // 是否在指定的范围
    static isScope(o, scope, message) {
        if (o >= scope[0] && o<= scope[1]) {
            return true;
        }
        throw new CoreError(message, 8);
    }
    // 必须为bool
    static isBool(o, message) {
        if (typeof o === 'boolean') {
            return true;
        }
        throw new CoreError(message, 9);
    }

}

module.exports = CoreError;