/**
 * Created by Administrator on 2018/6/8.
 */

const Consts = {
    headSize: 8,
    BufSize : 1*1024*1024
};

function getHead(buf){
    let cmd = 0, msglen = 0, check = 0, clientid = 0;
    let off = 0;
    cmd = buf.readUInt16BE(off);
    msglen = buf.readUInt16BE(off+2);
    check = buf.readUInt16BE(off+4);
    clientid = buf.readUInt16BE(off+6);
    return {cmd,msglen,check,clientid};
}

exports = {
    getHead,Consts
};
Object.assign(module.exports, exports);