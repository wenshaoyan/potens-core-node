/**
 * Created by wenshao on 2018/03/01.
 * 异常类
 */
'use strict';

class CoreException extends Error{
    constructor(code, type, message, serverName, methodName, fullMessage) {
        super();
        this.name = 'CoreException';
        if (typeof code === 'object') {
            const obj = code;
            this._code = obj.code;
            this._serverName = obj.serverName;
            this._message = obj.message;
            this._methodName = obj.methodName;
            this._fullMessage = obj.fullMessage;
            this._type = obj.type;
        }else{
            this._code = code;
            this._serverName = serverName;
            this._message = message;
            this._methodName = methodName;
            this._fullMessage = fullMessage;
            this._type = type;
        }

    }

    get code() {
        return this._code;
    }

    set code(value) {
        this._code = value;
    }

    get type() {
        return this._type;
    }

    set type(value) {
        this._type = value;
    }

    get message() {
        return this._message;
    }

    set message(value) {
        this._message = value;
    }

    get serverName() {
        return this._serverName;
    }

    set serverName(value) {
        this._serverName = value;
    }

    get methodName() {
        return this._methodName;
    }

    set methodName(value) {
        this._methodName = value;
    }

    get fullMessage() {
        return this._fullMessage;
    }

    set fullMessage(value) {
        this._fullMessage = value;
    }
    toJson() {
        return {
            code: this.code,
            serverName: this.serverName,
            message: this.message,
            methodName: this.methodName,
            fullMessage: this.fullMessage,
            type: this.type,
        }
    }
    toString(){
        return JSON.stringify({
            code: this.code,
            serverName: this.serverName,
            message: this.message,
            methodName: this.methodName,
            fullMessage: this.fullMessage,
            type: this.type,
        });
    }
}

module.exports = CoreException;