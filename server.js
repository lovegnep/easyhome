const Net = require('net');
const Logger = require('./logger');
const MsgType = require('./common/msgtype')
const Config = require('./config');

let init = 1;
let clients = new Map();//远程客户端  id == > socket
let masterClient = null;//主客户端，家里的电脑
function processMsgFromLocalClient(msgHead, msgBuf){
    let client = clients.get(msgHead.clientid);
    if(!client){
        Logger.error('没能找到远程客户端，也许已经关闭了。',msgHead.cliendid);
        return;
    }
    if(msgHead.cmd === MsgType.MsgType.remove){
        Logger.info('家里的客户端发出命令摧毁远程客户端');
        client.socket.destroy();
        clients.delete(msgHead.clientid)
        return;
    }
    Logger.debug('send msg to remote client.',msgHead,msgBuf.length);
    client.socket.write(msgBuf);
}
function processMsgFromRemoteClient(clientId, msgBuf, port){
    let msgLen = MsgType.Consts.headSize+ (msgBuf ? msgBuf.length : 0);
    let buf = new Buffer(msgLen);
    if(msgBuf){
        MsgType.setBuf(buf, msgBuf, clientId, port);
    }else{
        MsgType.setRemoveHead(buf,clientId);
    }
    if(masterClient){
        Logger.debug('向家里的电脑转发消息');
        masterClient.write(buf);
    }
}
function masterServer(port){
    this.client = null;
    this.port = port;
    this.server = null;
    let buf = new Buffer(MsgType.Consts.BufSize);
    let offsite = 0;
    let self = this;
    this.cb = function(data){
        data.copy(buf,offsite);
        offsite+=data.length;
        Logger.debug('offsite:%d, data.length:%d',offsite, data.length);
        if(offsite >= MsgType.Consts.headSize){
            let bufhead = buf.slice(0,MsgType.Consts.headSize);
            let msghead = MsgType.getHead(bufhead);
            Logger.debug('masterServer: inside client come data:',msghead, offsite);
            while(offsite >= MsgType.Consts.headSize+msghead.msglen){
                let msgbuf = buf.slice(MsgType.Consts.headSize,MsgType.Consts.headSize+msghead.msglen);
                processMsgFromLocalClient(msghead,msgbuf);
                let tmpbuf = new Buffer(MsgType.Consts.BufSize);
                tmpbuf.fill(0,0,MsgType.Consts.BufSize);
                buf.copy(tmpbuf,0,MsgType.Consts.headSize+msghead.msglen);
                buf = tmpbuf;
                offsite -= (MsgType.Consts.headSize+msghead.msglen);
                Logger.debug('init the buf with new offsite:',offsite);
                if(offsite >= MsgType.Consts.headSize){
                    bufhead = buf.slice(0,MsgType.Consts.headSize);
                    msghead = MsgType.getHead(bufhead);
                }else{
                    break;
                }
            }
        }
    }
}
masterServer.prototype.listen = function(){
    let self = this;
    let ser = Net.createServer(function(socket){
        Logger.debug('客户端成功连接');
        socket.setNoDelay(true);
        socket.setKeepAlive(true,10000);
        socket.on('error',function(err){
            Logger.debug('客户端socket error.',err);
        });
        socket.on('close',function(){
            self.client = null;
            masterClient = null;
            socket.destroy();
            Logger.debug('客户端断开连接');
        });
        socket.on('data',self.cb);
        self.client = socket;
        masterClient = socket;
    });
    ser.listen(this.port, function(){
        Logger.info('server listen %d success.',self.port);
    });
    this.server = ser;
};

let master = new masterServer(Config.masterServer.port);
master.listen();


/*远程客户端*/
function client(socket, port){
    this.socket = socket;
    this.id = init++;
    this.port = port;
}
client.prototype.datacb = function(data){
    if(!master.client){
        this.socket.destroy();
        return clients.delete(this.id);
    }
    processMsgFromRemoteClient(this.id,data,this.port);
};
client.prototype.closecb = function(){
    Logger.debug('远程客户端close socket:',this.id);
    if(master.client){
        processMsgFromRemoteClient(this.id, null, this.port);
    }
    clients.delete(this.id)
};
client.prototype.timeoutclosecb = function(){
    Logger.debug('远程客户端超时关闭close socket:',this.id);
    if(master.client){
        processMsgFromRemoteClient(this.id, null, this.port);
    }
    this.socket.destroy();
    clients.delete(this.id);
};


/*代理服务器*/
let serverid = 1;
let proxyServerList = new Map();
function server(port){
    this.clients = [];
    this.port = port;
    this.server = null;
    this.id = serverid++;
}
server.prototype.listen = function(){
    let self = this;
    let ser = Net.createServer(function(socket){
        Logger.debug('remote client com.',{localAddress:socket.localAddress, localPort:socket.localPort,remoteAddress:socket.remoteAddress,remotePort:socket.remotePort});
        socket.setNoDelay(true);
        socket.setKeepAlive(true,10000);
        socket.setTimeout(MsgType.Consts.TimeOut);

        if(!master.client){
            return socket.destroy();
        }
        let newclient = new client(socket, self.port);
        clients.set(newclient.id, newclient);
        socket.on('timeout',newclient.timeoutclosecb.bind(newclient));
        socket.on('error',function(err){
            Logger.error('远程客户端error.',err);
        });
        socket.on('close',newclient.closecb.bind(newclient));
        socket.on('data',newclient.datacb.bind(newclient));
    });
    ser.listen(this.port, function(){
        Logger.info('server listen %d success.',self.port);
    });
    this.server = ser;
};

for(let i = 0; i < Config.proxyServer.length; i++){
    let tmpserver = new server(Config.proxyServer[i].port);
    tmpserver.listen();
    proxyServerList.set(tmpserver.id, tmpserver);
}

/*统计信息*/
setInterval(function(){
    let localID = [...clients.keys()];
    let proxy = [...proxyServerList.keys()];
    Logger.debug('当前远程客户端数量：',localID.length, localID);
    Logger.debug('当前代理服务器数量：',proxy.length, proxy);
},10000);

