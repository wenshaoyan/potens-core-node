/**
 * Created by wenshao on 2017/9/12.
 */
// 'use strict';
const thrift = require('thrift');
const transport = thrift.TFramedTransport;
const protocol = thrift.TBinaryProtocol;
const genericPool = require('generic-pool');
const _poolTagObject = {};
const Interceptor = require('function-interceptor');
class TimeoutException {
    constructor() {
        this.code = null;
        this.message = null;
        this.serverName = null;
        this.methodName = null;
        this.fullMessage = null;
        this.name = 'TimeoutException';
    }

    static name() {
        return 'TimeoutException';
    }
}



const Server = (function () {
    const _isPrintLog = Symbol('_isPrintLog');
    const _poolUuid = Symbol('_poolUuid');

    class Server {
        constructor() {
            this._host = '127.0.0.1';
            this._port = '80';
            this._serverObject = null;
            this._connection = null;
            this._errorCallback = null;
            this._connectionStatus = 0; // 0 待连接 1 连接成功 2 连接断开
            this._min = 1;
            this._max = 10;
            this._client = null;
            this[_isPrintLog] = false;
            this._name = '';
            this._pool = null;
            this[_poolUuid] = new Date().getTime() + Math.floor(Math.random() * 1000);
            _poolTagObject[this[_poolUuid]] = {}
            this._ProxyClient = function () {

            };
            this._interceptor = null;
        }


        get host() {
            return this._host;
        }

        set host(value) {
            this._host = value;
        }

        get port() {
            return this._port;
        }

        set port(value) {
            this._port = value;
        }

        get serverObject() {
            return this._serverObject;
        }

        set serverObject(value) {
            this._serverObject = value;
        }


        get connection() {
            return this._connection;
        }

        set connection(value) {
            this._connection = value;
        }


        get errorCallback() {
            return this._errorCallback;
        }

        set errorCallback(value) {
            this._errorCallback = value;
        }


        get connectionStatus() {
            return this._connectionStatus;
        }

        set connectionStatus(value) {
            this._connectionStatus = value;
        }


        get min() {
            return this._min;
        }

        set min(value) {
            this._min = value;
        }

        get max() {
            return this._max;
        }

        set max(value) {
            this._max = value;
        }

        get connectZk() {
            return this._connectZk;
        }

        set connectZk(value) {
            this._connectZk = value;
        }

        get logger() {
            return this._logger;
        }

        set logger(value) {
            if (value && value.info instanceof Function) this[_isPrintLog] = true;
            this._logger = value;

        }


        get pool() {
            return this._pool;
        }

        set pool(value) {
            this._pool = value;
        }

        get name() {
            return this._name;
        }

        set name(value) {
            this._name = value;
        }

        setName(value) {
            this.name = value;
            return this;
        }


        get interceptor() {
            return this._interceptor;
        }

        set interceptor(value) {
            this._interceptor = value;
        }

        setAddress(address) {
            if (typeof address === 'string' && address.indexOf(':') !== -1) {
                const split = address.split(':');
                this.host = split[0];
                this.port = split[1];
                if (this.connectionStatus === 2) {
                    this.connect();
                } else if (this.connectionStatus === 0) {
                    this._connect();
                }
            } else {
                this.connectionStatus = 0;
                // throw new Error(address + ' is error!');
            }
            return this;
        }

        getAddress() {
            return this.host + ':' + this.port;
        }

        setServer(_serverObject) {
            this.serverObject = _serverObject;
            this.interceptor = new Interceptor(_serverObject.Client);

            const than = this;
            for (const f in _serverObject.Client.prototype) {
                this._ProxyClient[f] = function() {
                    const args = arguments;
                    return than.getClient().then(function(client) {
                        if (client[f]) return client[f](...args);
                        else return Promise.reject(f + 'not in client');
                    });

                }
            }
            return this;
        }

        setPoolNumber(_min, _max) {
            if (typeof _min === 'number' && _min > 0 && _min < 100) this.min = _min;
            if (typeof _max === 'number' && _max > 0 && _max < 1000 && _max > _min) this.max = _max;
            return this;
        }

        setErrorCallback(callback) {
            this.errorCallback = callback;
            return this;
        }


        connect() {
            if (this.connectionStatus === 0 || this.connectionStatus === 1) {
                return this;
            }
            this._connect();
            return this;
        }

        _connect() {
            this.close();
            this._initPool();
            const cHost = this.host;
            const cPort = this.port;
            const cServerObject = this.serverObject;
            const logger = this.logger;
            const than = this;
            this.interceptor.restoreBack();
            this.interceptor.init();

            this.interceptor.monitorPrototypeRe(/^send_/, function (data) {
                if (!this.timer) this.timer = {};
                const id = this.seqid();
                this.timer[id] = setTimeout(() => {
                    const callback = this._reqs[id] || function () {
                        };
                    delete this._reqs[id];
                    const re = new TimeoutException();
                    re.code = 810;
                    re.message = 'timeout';
                    re.serverName = cServerObject.name;
                    re.methodName = data.name;
                    re.fullMessage = 'timeout';
                    callback(re)
                }, 10000)
            }, undefined, false);
            this.interceptor.monitorPrototypeRe(/^recv_/, function (data) {
                than.pool.release(this);
                const id = this.seqid();
                if (this.timer && this.timer[id]) clearTimeout(this.timer[id]);
            }, undefined, false);
            this.interceptor.release();
            // this._client = thrift.createClient(this.serverObject, this.connection);
            const factory = {
                create: function () {
                    return new Promise(function (resolve, reject) {
                        let con;
                        con = thrift.createConnection(cHost, cPort, {
                            transport: transport,
                            protocol: protocol
                        });
                        con.on('error', (err) => {
                            if (logger) logger.error(err);
                            reject(err);
                            // this.connectionStatus = 2;
                            // if (this.errorCallback instanceof Function) this.errorCallback(err);
                        });
                        const client = thrift.createClient(cServerObject, con);
                        resolve(client);
                    })
                },
                destroy: function (client) {
                    return new Promise(function (resolve) {
                        resolve();
                        client.end();
                    })
                }
            };
            this.pool = genericPool.createPool(factory, {max: this.max, min: this.min});
            this.connectionStatus = 1;
            if (this[_isPrintLog]) this.logger.info(`${this.name}:connect ${this.host}:${this.port} `);
        }

        /**
         * 从连接池获取连接 废弃  设计思想仅供参考
         * @param uuid                  唯一码
         * @return {Promise.<Client>}   返回客户端
         */
        _getClientOld(uuid) {
            if (!uuid || typeof uuid !== 'string') {
                throw new Error('uuid error');
            }

            const resourcePromise = this.pool.acquire();
            return resourcePromise.then(client => {

                let list = _poolTagObject[this[_poolUuid]][uuid];
                if (list && list instanceof Array) {
                    list.push(client);
                } else {
                    _poolTagObject[this[_poolUuid]][uuid] = [client];
                }
                return client;
            }).catch(e => {
                throw e;
            });
        }
        /**
         * 从连接池获取连接
         * @return {Promise.<Client>}   返回客户端
         */
        getClient() {
            if (!this.pool) {
                throw new Error(`${this.name} not pool`);
            }
            const resourcePromise = this.pool.acquire();
            return resourcePromise.then(client => {
                return client;
            }).catch(e => {
                throw e;
            });
        }
        /**
         * 获取代理客户端
         * @return {_ProxyClient}    代理客户端
         */
        getProxyClient() {
            return this._ProxyClient;
        }

        // 清空连接池
        _initPool() {
            if (this.pool) {
                this.pool.clear();
                this.pool = null;
            }
        }


        close() {
            if (this.connectionStatus === 1) {
                this.connectionStatus = 2;
                this._initPool();
            }
        }

        setLogger(func) {
            if ('info' in func) {
                this.logger = func;
                return this;
            }
            throw new Error('func not is Logger object');

        }
        /**
         * 从连接池释放连接 废弃  设计思想仅供参考
         * @param uuid                  唯一码
         */
        _release(uuid) {
            if (!uuid || typeof uuid !== 'string') {
                throw new Error('uuid error');
            }
            let list = _poolTagObject[this[_poolUuid]][uuid];
            if (list && list instanceof Array && this.pool) {
                list.forEach(c => {
                    this.pool.release(c);
                });
                delete _poolTagObject[uuid];
            }
        }
    }

    return Server;
})();


module.exports = Server;
