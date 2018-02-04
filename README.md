# thrift-node-core
以thrift+zookeeper实现的后端底层框架，thrift用来进行可扩展且跨语言的服务的开发，zookeeper用来实现服务的统一管理和配置中心</br>

## **主要功能**
* 连接到zk和thrift服务端.
* 指定thrift服务端的zk的路径,可自动连接路径下的子节点对应的地址.
* thrift连接为连接池.
* 基于配置启动服务.
