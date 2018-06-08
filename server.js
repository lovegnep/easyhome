const Net = require('net');
const Logger = require('./logger');
const headSize = 2+2+2+2;
const BufSize = 1024*1024;

let init = 1;
let clients = new Map();
function getHead(buf){
    let cmd = 0, msglen = 0, check = 0, clientid = 0;
    let off = 0;
    cmd = buf.readUInt16BE(off);
    msglen = buf.readUInt16BE(off+2);
    check = buf.readUInt16BE(off+4);
    clientid = buf.readUInt16BE(off+6);
    return {cmd,msglen,check,clientid};
}
function masterServer(port){
    this.client = null;
    this.port = port;
    this.server = null;
    let buf = new Buffer(BufSize);
    let offsite = 0;
    let self = this;
    this.cb = function(data){
        data.copy(buf,offsite);
        offsite+=data.length;
        Logger.debug('offsite:%d, data.length:%d',offsite, data.length);
        if(offsite >= headSize){
            let bufhead = buf.slice(0,headSize);
            let msghead = getHead(bufhead);
            Logger.debug('masterServer: inside client come data:',msghead, offsite);
            while(offsite >= headSize+msghead.msglen){
                let msgbuf = buf.slice(headSize,headSize+msghead.msglen);
                self.client.processmsg(msghead,msgbuf);
                let tmpbuf = new Buffer(BufSize);
                tmpbuf.fill(0,0,BufSize);
                buf.copy(tmpbuf,0,headSize+msghead.msglen);
                buf = tmpbuf;
                offsite -= (headSize+msghead.msglen);
                Logger.debug('init the buf with new offsite:',offsite);
                if(offsite >= headSize){
                    bufhead = buf.slice(0,headSize);
                    msghead = getHead(bufhead);
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
            socket.destroy();
            self.client = null;
            Logger.debug('客户端断开连接');
        });
        socket.on('data',self.cb);
        socket.on('timeout',function(){
            Logger.debug('client timeout, do nothing');
        });
        self.client = new client(socket);
    });
    ser.listen(this.port, function(){
        Logger.info('server listen %d success.',self.port);
    });
    this.server = ser;
};
masterServer.prototype.send = function(buf, sourceid){
    this.client.write(buf, sourceid);
};

let master = new masterServer(22000);
master.listen();


function client(socket){
    this.socket = socket;
    this.id = init++;
}
client.prototype.datacb = function(data){
    if(!master.client){
        this.socket.destroy();
        return clients.delete(this.id);
    }
    master.send(data, this.id);
};
client.prototype.closecb = function(){
    Logger.debug('close socket:',this.id);
    if(master.client){
        master.send(null, this.id);
    }
    clients.delete(this.id)
};
client.prototype.timeoutclosecb = function(){
    Logger.debug('远程客户端超时关闭close socket:',this.id);
    if(master.client){
        master.send(null, this.id);
    }
    this.socket.destroy();
    clients.delete(this.id);
};
client.prototype.write = function(msg, id){
    if(!msg){
        let buf = new Buffer(BufSize);
        let off =0;
        buf.fill(0,0,BufSize);
        buf.writeUInt16BE(1, off);//cmd
        buf.writeUInt16BE(0, off+2);//msglen
        buf.writeUInt16BE(0xabcd, off+4);//check
        buf.writeUInt16BE(id, off+6);//clientid
        return this.socket.write(buf.slice(0,8));
    }else if(!msg.cmd){//buffer
        let buf = new Buffer(BufSize);
        let off =0;
        buf.fill(0,0,BufSize);
        buf.writeUInt16BE(0, off);//cmd
        let msglen = msg.length;
        msg.copy(buf,8);
        buf.writeUInt16BE(msglen, off+2);//len
        buf.writeUInt16BE(0xabcd, off+4);//check
        buf.writeUInt16BE(id, off+6);//clientid
        Logger.debug('send msg to inside client:',{cmd:0,msglen:msglen,check:0xabcd,cliendid:id});
        return this.socket.write(buf.slice(0,8+msglen));
    }
    let buf = new Buffer(BufSize);
    buf.fill(0,0,BufSize);
    let off = 0;
    let msglen = msg.write(buf, off+8);
    buf.writeUInt16BE(msg.cmd, off);
    buf.writeUInt16BE(msglen, off+2);
    buf.writeUInt16BE(0xabcd, off+4);
    buf.writeUInt16BE(id, off+6);
    this.socket.write(buf.slice(0,8+msglen));
}
client.prototype.processmsg = function(msghead,msgbuf){
    let client = clients.get(msghead.clientid);
    if(!client){
        Logger.error('没能找到远程客户端，也许已经关闭了。',msghead.cliendid);
        return;
    }
    Logger.debug('send msg to remote client.',msghead,msgbuf.length);
    client.socket.write(msgbuf);
};

function server(port){
    this.clients = [];
    this.port = port;
    this.server = null;
}
server.prototype.listen = function(){
    let self = this;
    let ser = Net.createServer(function(socket){
        Logger.debug('client com.',{localAddress:socket.localAddress, localPort:socket.localPort,remoteAddress:socket.remoteAddress,remotePort:socket.remotePort});
        socket.setNoDelay(true);
        socket.setKeepAlive(true,10000);
        socket.setTimeout(60000);

        if(!master.client){
            return socket.destroy();
        }
        let newclient = new client(socket);
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

let server81 = new server(81);
server81.listen();
let server21001 = new server(21001);
server21001.listen();
setInterval(function(){
    let localID = [...clients.keys()];
    Logger.debug('当前远程客户端数量：',localID.length, localID);
},10000);

