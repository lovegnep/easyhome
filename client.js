const Net = require('net');
const Logger = require('./logger');
const MsgType = require('./common/msgtype');

const localPort = 21001;
const localAddr = '192.168.31.169';
const remotePort = 22000;
const remoteAddr = '47.105.36.1';

let localClients = new Map();//  id ===>  localsocket
let masterclient = null;

let id = 1;
function localSocket(socket, sourceid, port){
    this.socket = socket;
    this.id = id++;//本地id
    this.sourceid = sourceid;//远程id
    this.port = port;
}
localSocket.prototype.datacb = function(data){//本地socket来数据
    let msghead = {cmd:MsgType.MsgType.normal,msglen:data.length,check:MsgType.Consts.MagicNum,clientid:this.sourceid};
    Logger.debug('send msg to remote client',msghead,data.length);
    let buf = new Buffer(MsgType.Consts.headSize+data.length);
    MsgType.setBuf(buf, data,this.sourceid);
    masterclient.write(buf);
};
localSocket.prototype.closecb = function(){//本地socket来数据
    let buf = new Buffer(MsgType.Consts.headSize);
    MsgType.setRemoveHead(buf, this.sourceid);
    masterclient.write(buf);
};

function init(){
    masterclient = new Net.Socket();
    masterclient.connect({host:remoteAddr,port:remotePort},function(){
        Logger.info('masterclient connect succss.');
    });
    let buf = new Buffer(MsgType.Consts.BufSize);
    buf.fill(0,0,MsgType.Consts.BufSize);
    let offsite = 0;
    masterclient.on('data',function(data){
        Logger.debug('masterclient receive server data:',data.length);
        data.copy(buf,offsite);
        offsite += data.length;
        function processmsg(){
            if(offsite >= MsgType.Consts.headSize){
                let msghead = MsgType.getHead(buf.slice(0,MsgType.Consts.headSize));
                Logger.debug('masterclient:on data',msghead);
                if(msghead.cmd === 1){//说明远程某个客户端关闭了,要关闭本地的
                    let loccl = localClients.get(msghead.clientid);
                    if(loccl){
                        loccl.socket.destroy();
                        localClients.delete(msghead.clientid);
                        Logger.debug('destroy local socket', msghead.clientid);
                    }
                    let tmpbuf = new Buffer(MsgType.Consts.BufSize);
                    tmpbuf.fill(0,0,MsgType.Consts.BufSize);
                    buf.copy(tmpbuf,0,MsgType.Consts.headSize);
                    buf = tmpbuf;
                    offsite -= MsgType.Consts.headSize;
                    return processmsg();
                }
                if(offsite >= MsgType.Consts.headSize+msghead.msglen){
                    Logger.debug('masterclient on data:',msghead);
                    let loccl = localClients.get(msghead.clientid);
                    if(loccl){
                        loccl.socket.write(buf.slice(MsgType.Consts.headSize,MsgType.Consts.headSize+msghead.msglen));
                        let tmpbuf = new Buffer(MsgType.Consts.BufSize);
                        tmpbuf.fill(0,0,MsgType.Consts.BufSize);
                        buf.copy(tmpbuf,0,MsgType.Consts.headSize+msghead.msglen);
                        buf = tmpbuf;
                        offsite -= (MsgType.Consts.headSize+msghead.msglen);
                        Logger.debug('masterclient on data:init offsite1:',offsite)
                        processmsg();
                    }else{
                        let socket = new Net.Socket();
                        let tmplo = new localSocket(socket, msghead.clientid, msghead.port);
                        localClients.set(msghead.clientid, tmplo);
                        socket.connect({host:localAddr,port:msghead.port},function(){
                            Logger.info('tmp socket connect success.');
                            socket.write(buf.slice(MsgType.Consts.headSize,MsgType.Consts.headSize+msghead.msglen));
                            let tmpbuf = new Buffer(MsgType.Consts.BufSize);
                            tmpbuf.fill(0,0,MsgType.Consts.BufSize);
                            buf.copy(tmpbuf,0,MsgType.Consts.headSize+msghead.msglen);
                            buf = tmpbuf;
                            offsite -= (MsgType.Consts.headSize+msghead.msglen);
                            processmsg();
                        });
                        socket.on('data', tmplo.datacb.bind(tmplo));
                        socket.on('close', tmplo.closecb.bind(tmplo));
                        socket.on('error',function(err){
                            Logger.error('local client err:',err);
                        });
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
setInterval(function(){
    let localID = [...localClients.keys()];
    Logger.debug('当前远程客户端与本地客户端数量：',localID.length, localID);
},10000);