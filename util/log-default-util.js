/**
 * Created by wenshao on 2018/2/4.
 * 默认logger
 */
'use strict';
class LogDefault {
    constructor() {

    }

    trace() {

    }

    debug() {

    }

    info() {

    }

    warn() {

    }

    error() {

    }

    fatal() {

    }
    static getLogger(){
        return new LogDefault();
    }
}
module.exports = LogDefault;
