/**
 * Created by wenshao on 2017/9/16.
 * 系统工具类
 */
'use strict';
const crypto = require('crypto');
let fs = require('fs');
let path = require('path');
const routerTypeSet = new Set(['config', 'controller', 'validator']);
class SysUtil {
    static md5(str) {
        return crypto.createHash('md5').update(str).digest('hex');
    }

    static getUuid() {
        return SysUtil.md5(new Date().getTime() + ' ' + Math.random());
    }

    /**
     *
     * @param startPath  起始目录文件夹路径
     * @returns {Array}
     */
    static loadDirFiles(startPath) {
        let result = [];

        function finder(p) {
            let files = fs.readdirSync(p);
            files.forEach((val, index) => {
                let fPath = path.join(p, val);
                let stats = fs.statSync(fPath);
                if (stats.isDirectory()) finder(fPath);
                if (stats.isFile()) result.push(path.resolve(fPath));
            });
        }

        finder(startPath);
        return result;
    }

    /**
     * 正常合并目录下的js文件 不分先后
     * @param dir
     */
    static normalMergeDirMethod(dir) {
        const list = SysUtil.loadDirFiles(dir);
        const data = {};
        for (const file of list) {
            const f = require(file);
            if (f && typeof f === 'object') {
                Object.keys(f).forEach(key => {
                    if (key in data) {
                        throw new Error(`normalMergeDirMethod:${key} is exist`);
                    }
                    data[key] = f[key];
                })
            }
        }
        return data;
    }

    /**
     * 正常合并目录下所有文件为一个文件 不分先后
     * @param dir
     * @return {string}
     */
    static normalMergeDirFile(dir) {
        const list = SysUtil.loadDirFiles(dir);
        let data = '';
        for (const file of list) {
            data += fs.readFileSync(file, 'utf8')

        }
        return data;
    }

    /**
     * @return {boolean}
     */
    static JSONParse(o) {
        try {
            o = JSON.parse(o);
            return typeof o === 'object' ? o : false;
        } catch (e) {
            return false;
        }
    }

    // 判断router目录下对应的文件类型  config、controller、validator
    static getRouterType(file) {
        const fileName = path.basename(file);

        const split = fileName.split('.');
        if (split.length !== 3) {
            return {message: `${file};filename error,can't have three point,for example:user.config.js`};
        }
        const dirName = path.basename(path.dirname(file));
        if (dirName !== split[0]) {
            return {message: `no load ${file};${split[0]} is not the same as the dir name,for example:user.config.js,he in the "user" dir`};
        }
        if (split[2] !== 'js' && split[2] !== 'json') {
            return {message: `${file};suffix only is js or json`};
        }
        if (!routerTypeSet.has(split[1])) {
            return {message: `${file};type only is config or controller or validator`};
        }
        return {type: split[1]};
    }

    /*
     ** randomWord 产生任意长度随机字母数字组合
     ** randomFlag-是否任意长度 min-任意长度最小位[固定位数] max-任意长度最大位
     */

    static randomWord(randomFlag, min, max) {
        let str = "",
            range = min,
            arr = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];

        // 随机产生
        if (randomFlag) {
            range = Math.round(Math.random() * (max - min)) + min;
        }
        for (let i = 0; i < range; i++) {
            const pos = Math.round(Math.random() * (arr.length - 1));
            str += arr[pos];
        }
        return str;

    }
}

module.exports = SysUtil;