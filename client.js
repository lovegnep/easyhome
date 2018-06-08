const Net = require('net');
const Logger = require('./logger');

const localPort = 21001;
const localAddr = '192.168.31.169';
const remotePort = 22000;
const remoteAddr = '47.105.36.1';

let localClients = new Map();//  id ===>  localsocket
const headSize = 2+2+2+2;
const BufSize = 1024*1024;
function getHead(buf){
    let cmd = 0, msglen = 0, check = 0, clientid = 0;
    let off = 0;
    cmd = buf.readUInt16BE(off);
    msglen = buf.readUInt16BE(off+2);
    check = buf.readUInt16BE(off+4);
    clientid = buf.readUInt16BE(off+6);
    return {cmd,msglen,check,clientid};
}
let masterclient = null;

let id = 1;
function localSocket(socket, sourceid){
    this.socket = socket;
    this.id = id++;//本地id
    this.sourceid = sourceid;//远程id
}
localSocket.prototype.datacb = function(data){//本地socket来数据
    let msghead = {cmd:0,msglen:data.length,check:0xabcd,clientid:this.sourceid};
    Logger.debug('send msg to remote client',msghead,data.length);
    let buf = new Buffer(BufSize);
    let off =0;
    buf.fill(0,0,BufSize);
    buf.writeUInt16BE(0, off);//cmd
    let msglen = data.length;
    data.copy(buf,8);
    buf.writeUInt16BE(msglen, off+2);//len
    buf.writeUInt16BE(0xabcd, off+4);//check
    buf.writeUInt16BE(this.sourceid, off+6);//clientid
    masterclient.write(buf.slice(0,8+msglen));
};
localSocket.prototype.closecb = function(){//本地socket来数据
    let buf = new Buffer(BufSize);
    let off =0;
    buf.fill(0,0,BufSize);
    buf.writeUInt16BE(1, off);//cmd
    buf.writeUInt16BE(0, off+2);//len
    buf.writeUInt16BE(0xabcd, off+4);//check
    buf.writeUInt16BE(this.sourceid, off+6);//clientid
    masterclient.write(buf.slice(0,8));
};

function init(){
    masterclient = new Net.Socket();
    masterclient.connect({host:remoteAddr,port:remotePort},function(){
        Logger.info('masterclient connect succss.');
    });
    let buf = new Buffer(BufSize);
    buf.fill(0,0,BufSize);
    let offsite = 0;
    masterclient.on('data',function(data){
        Logger.debug('masterclient receive server data:',data.length);
        data.copy(buf,offsite);
        offsite += data.length;
        function processmsg(){
            if(offsite >= headSize){
                let msghead = getHead(buf.slice(0,headSize));
                Logger.debug('masterclient:on data',msghead);
                if(msghead.cmd){//说明远程某个客户端关闭了,要关闭本地的
                    let loccl = localClients.get(msghead.clientid);
                    if(loccl){
                        loccl.socket.destroy();
                        localClients.delete(msghead.clientid);
                        Logger.debug('destroy local socket', msghead.clientid);
                    }
                    let tmpbuf = new Buffer(BufSize);
                    tmpbuf.fill(0,0,BufSize);
                    buf.copy(tmpbuf,0,headSize);
                    buf = tmpbuf;
                    offsite -= headSize;
                    return processmsg();
                }
                if(offsite >= headSize+msghead.msglen){
                    Logger.debug('masterclient on data:',msghead);
                    let loccl = localClients.get(msghead.clientid);
                    if(loccl){
                        loccl.socket.write(buf.slice(headSize,headSize+msghead.msglen));
                        let tmpbuf = new Buffer(BufSize);
                        tmpbuf.fill(0,0,BufSize);
                        buf.copy(tmpbuf,0,headSize+msghead.msglen);
                        buf = tmpbuf;
                        offsite -= (headSize+msghead.msglen);
                        Logger.debug('masterclient on data:init offsite1:',offsite)
                        processmsg();
                    }else{
                        let socket = new Net.Socket();
                        let tmplo = new localSocket(socket, msghead.clientid);
                        localClients.set(msghead.clientid, tmplo);
                        socket.connect({host:localAddr,port:localPort},function(){
                            Logger.info('tmp socket connect success.');
                            socket.write(buf.slice(headSize,headSize+msghead.msglen));
                            let tmpbuf = new Buffer(BufSize);
                            tmpbuf.fill(0,0,BufSize);
                            buf.copy(tmpbuf,0,headSize+msghead.msglen);
                            buf = tmpbuf;
                            offsite -= (headSize+msghead.msglen);
                            processmsg();
                        });
                        socket.on('data', tmplo.datacb.bind(tmplo));
                        socket.on('close', tmplo.closecb.bind(tmplo));
                        socket.on('error',function(err){});
                    }

                }
            }
        }
        processmsg();
    });
    masterclient.on('close',function(){
        Logger.debug('masterclient close.');
        masterclient.destroy();
        masterclient = null;
        Logger.debug('client will retry connect to server after 5s.');
        setTimeout(init,5000);
    });
    masterclient.on('error',function(err){
        Logger.info('masterclient error.',err);
    });
}
init();
