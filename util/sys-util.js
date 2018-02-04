/**
 * Created by wenshao on 2017/9/16.
 * 系统工具类
 */
'use strict';
const crypto = require('crypto');
let fs = require('fs');
let path = require('path');

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
}
module.exports = SysUtil;