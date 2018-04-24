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
            this.code = obj.code;
            this.serverName = obj.serverName;
            this.message = obj.message;
            this.methodName = obj.methodName;
            this.fullMessage = obj.fullMessage;
            this.type = obj.type;
        }else{
            this.code = code;
            this.serverName = serverName;
            this.message = message;
            this.methodName = methodName;
            this.fullMessage = fullMessage;
            this.type = type;
        }

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