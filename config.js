/**
 * Created by Administrator on 2018/6/8.
 */

exports = {
    masterServer:{
        host:'0.0.0.0',
        port:22000
    },
    proxyServer:[
        {
            host:'0.0.0.0',
            port:81
        },
        {
            host:'0.0.0.0',
            port:21001
        },
        {
            host:'0.0.0.0',
            port:3389
        }
    ]
};
Object.assign(module.exports, exports);