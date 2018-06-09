/**
 * Created by Administrator on 2018/6/8.
 */

const Consts = {
    headSize: 18,
    BufSize : 1*1024*1024,
    MagicNum:0xabcddcba,
    TimeOut:10*60*1000
};

const MsgType = {
    normal:0,
    remove:1
};
function setRemoveHead(buf, clientId){//组装删除客户端消息
    let off =0 ;
    buf.writeUInt32BE(MsgType.remove,off);//cmd
    buf.writeUInt32BE(0,off+4);//msglen
    buf.writeUInt32BE(Consts.MagicNum,off+8);//check
    buf.writeUInt32BE(clientId,off+12);//clientid
    buf.writeUInt16BE(0,off+16);//port
}
function setBuf(buf, databuf, clientId, port){//组装普通消息
    let off =0 ;
    buf.writeUInt32BE(MsgType.normal,off);//cmd
    buf.writeUInt32BE(databuf.length,off+4);//msglen
    buf.writeUInt32BE(Consts.MagicNum,off+8);//check
    buf.writeUInt32BE(clientId,off+12);//clientid
    buf.writeUInt16BE(port || 0,off+16);//port
    databuf.copy(buf, off+18);
}
function getHead(buf){
    let cmd = 0, msglen = 0, check = 0, clientid = 0, port = 0;
    let off = 0;
    cmd = buf.readUInt32BE(off);
    msglen = buf.readUInt32BE(off+4);
    check = buf.readUInt32BE(off+8);
    clientid = buf.readUInt32BE(off+12);
    port = buf.readUInt16BE(off+16);
    return {cmd,msglen,check,clientid,port};
}

exports = {
    getHead,Consts,setRemoveHead,setBuf,MsgType
};
Object.assign(module.exports, exports);