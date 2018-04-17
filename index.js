/**
 * Created by wenshao on 2018/1/27.
 */
'use strict';

// exports Middleware start
const middleware = {};
Object.defineProperty(middleware, 'formatQuery', {
    enumerable: true,
    get: function get() {
        return require('./middleware/format-query');
    }
});
Object.defineProperty(middleware, 'methodQuery', {
    enumerable: true,
    get: function get() {
        return require('./middleware/method-query');
    }
});
Object.defineProperty(middleware, 'graphqlKoa', {
    enumerable: true,
    get: function get() {
        return require('./middleware/graphql-koa');
    }
});
Object.defineProperty(middleware, 'routerLog', {
    enumerable: true,
    get: function get() {
        return require('./middleware/router-log');
    }
});
Object.defineProperty(middleware, 'response', {
    enumerable: true,
    get: function get() {
        return require('./middleware/response');
    }
});
Object.defineProperty(exports, 'Middleware', {
    enumerable: true,
    get: function get() {
        return middleware;
    }
});
// exports Middleware end


// exports SysUtil start
const {getUuid, loadDirFiles, normalMergeDirFile, normalMergeDirMethod} = require('./util/sys-util');
const {baseSchemaString} = require('./util/grqphql-util');
const sysUtil = {};
Object.defineProperty(sysUtil, 'getUuid', {
    enumerable: true,
    get: function get() {
        return getUuid;
    }
});
Object.defineProperty(sysUtil, 'loadDirFiles', {
    enumerable: true,
    get: function get() {
        return loadDirFiles;
    }
});
Object.defineProperty(sysUtil, 'normalMergeDirFile', {
    enumerable: true,
    get: function get() {
        return normalMergeDirFile;
    }
});
Object.defineProperty(sysUtil, 'normalMergeDirMethod', {
    enumerable: true,
    get: function get() {
        return normalMergeDirMethod;
    }
});
Object.defineProperty(sysUtil, 'baseSchemaString', {
    enumerable: true,
    get: function get() {
        return baseSchemaString;
    }
});
Object.defineProperty(exports, 'SysUtil', {
    enumerable: true,
    get: function get() {
        return sysUtil;
    }
});
// exports SysUtil end




// exports Application start
const {start, exit} = require('./util/start-service-util');
const application = {};
Object.defineProperty(application, 'start', {
    enumerable: true,
    get: function get() {
        return start;
    }
});

Object.defineProperty(application, 'exit', {
    enumerable: true,
    get: function get() {
        return exit;
    }
});
Object.defineProperty(exports, 'Application', {
    enumerable: true,
    get: function get() {
        return application;
    }
});

// exports Application end

// exports Call start
const {getThrift,  basicSendMail} = require('./util/start-service-util');
const call = {};
Object.defineProperty(call, 'getThrift', {
    enumerable: true,
    get: function get() {
        return getThrift;
    }
});
Object.defineProperty(call, 'basicSendMail', {
    enumerable: true,
    get: function get() {
        return basicSendMail;
    }
});
Object.defineProperty(exports, 'Call', {
    enumerable: true,
    get: function get() {
        return call;
    }
});
// exports Call end




// exports bean start
const bean = {};
Object.defineProperty(bean, 'getThrift', {
    enumerable: true,
    get: function get() {
        return require('./bean/AbstractSqlBean');
    }
});

Object.defineProperty(exports, 'Bean', {
    enumerable: true,
    get: function get() {
        return bean;
    }
});
// exports bean end






const CoreException = require('./exception/core-exception');



