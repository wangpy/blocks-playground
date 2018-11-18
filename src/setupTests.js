var log = require('loglevel');

log.info = console.log;
log.debug = console.log;
log.trace = console.log;
console.debug = console.log;
console.trace = console.log;
console.info = console.log;