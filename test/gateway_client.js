/**
 * Created by wenshao on 2018/4/6.
 */
'use strict';
const config = {
    "protocol": "amqp",
    "hostname": "120.92.108.221",
    "port": "5672",
    "username": "admin-project",
    "password": "314106",
    "vhost": "/service/admin",
    "ssl": {
        "enabled": false
    }
}
const amqp = require('amqplib');
let uuid = 1;
let n = 10;

const q = 'user.users';
(async function () {
    const conn = await amqp.connect(config);
    const ch = await conn.createChannel();

    ch.on('error', function (error) {
        console.log('==============', error)
    });
    const data = {"params":{"a":1},"query":{},"body":{},"call_chain":[],"id":"req-1"};
    await ch.publish('amq.topic', 'get.v1.users', Buffer.from(JSON.stringify(data)));


    const corrId = (uuid++)+'';
    function maybeAnswer(msg) {
        if (msg.properties.correlationId === corrId) {
            console.log(msg.content.toString());
        }
    }

    const {queue} = await ch.assertQueue('', {exclusive: true});
    const ok = await ch.consume(queue, maybeAnswer, {noAck: true});

    setInterval(()=> {
        ch.publish('amq.topic', 'get.v1.users', Buffer.from(JSON.stringify(data)),{
            correlationId: corrId, replyTo: queue
        });
    },10)




})();