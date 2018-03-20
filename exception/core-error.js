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
            this._code = obj.code;
            this._message = obj.message;
        } else {
            this._code = code;
            this._message = message;
        }

    }

    get code() {
        return this._code;
    }

    set code(value) {
        this._code = value;
    }


    get message() {
        return this._message;
    }

    set message(value) {
        this._message = value;
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
        throw new CoreError(message, 4);
    }
}

module.exports = CoreError;