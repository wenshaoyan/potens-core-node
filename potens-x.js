/**
 * Created by wenshao on 2018/4/14.
 * 存放core中全局变量
 */
'use strict';
const data = {};


class PotensX {
    static set(key, value) {
        if (typeof key === 'string') {
            data[key] = value;
            return true;
        }
        return false;
    }
    static get(key, defaultValue) {
        if (typeof key === 'string' && key in data) {
            return data[key];
        }
        return defaultValue;
    }
}
module.exports = PotensX;

