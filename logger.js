/**
 * Created by Administrator on 2018/4/12.
 */
var log4js = require('log4js');
log4js.configure({
    appenders: {
        out: { type: 'stdout' },//设置是否在控制台打印日志
        info: { type: 'file', filename: './logs/info.log' }
    },
    categories: {
        default: { appenders: [ 'out', 'info' ], level: 'debug' }//去掉'out'。控制台不打印日志
    }
});
var logger = log4js.getLogger();
logger.level = 'debug';
module.exports = logger;
