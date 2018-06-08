
function Test(){
    this.id=0;
    this.name='hehe';
}
Test.prototype.cmd = 1;
Test.prototype.write = function(buf, offset){
    let off = offset;
    buf.writeInt16BE(this.id,off);
    off += 2;
    let len = buf.write(this.name,off+2);
    buf.writeInt16BE(len,off);
    return off+2+len;
};
Test.prototype.read = function(buf){
    let off = 0;
    this.id = buf.readInt16BE(off);
    off += 2;
    let len = buf.readInt16BE(off);
    off += 2;
    this.name = buf.toString('utf8',off,off+len);
    return off+len;
};
exports = {
    Test
};
Object.assign(module.exports,exports);