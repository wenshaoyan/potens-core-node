/**
 * Created by wenshao on 2018/4/6.
 */
'use strict';
const config = {
    "protocol": "amqp",
    "hostname": "120.92.108.221",
    "port": "5672",
    "username": "gateway",
    "password": "123456",
    "vhost": "/gateway",
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
    await ch.publish('admin.topic', 'get.v1.users', Buffer.from(JSON.stringify(data)));


    const corrId = (uuid++)+'';
    function maybeAnswer(msg) {
        if (msg.properties.correlationId === corrId) {
            console.log(msg.content.toString());
        }
    }

    const {queue} = await ch.assertQueue('rpc_111', {exclusive: true});
    console.log(queue);

    await ch.consume(queue, maybeAnswer, {noAck: true});

    // setInterval(()=> {
    ch.publish('amq.topic', 'get.v1.user', Buffer.from(JSON.stringify(data)),{
            correlationId: corrId, replyTo: queue
    });
    // },10)

    try{
        const re = await ch.checkExchange('amq.topic1');
    }catch (e) {
        console.log(e);

    }



    /*var NUM_MSGS = 20;

    function mkCallback(i) {
        return (i % 2) === 0 ? function(err) {
            if (err !== null) { console.error('Message %d failed!', i); }
            else { console.log('Message %d confirmed', i); }
        } : null;
        // console.log()
    }

        conn.createConfirmChannel().then(function(ch) {
            for (var i=0; i < NUM_MSGS; i++) {
                ch.publish('amq.topic', 'get.v1.users1', Buffer.from('blah'), {}, mkCallback(i));
            }
            ch.waitForConfirms().then(function() {
                console.log('All messages done');
                //c.close();
            }).catch(console.error);
        });*/



})();