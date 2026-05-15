const assert = require('assert');
const TrafficManager = require('./src/traffic/trafficManager');

console.log("Validating methods exist...");
const methods = [
    'getVirtualState',
    'registerTransfer',
    'registerWithdraw',
    'registerPickup',
    'registerHarvest',
    'registerDrop',
    'registerUpgradeController',
    'registerBuild',
    'registerRepair',
    'flushIntent'
];

methods.forEach(method => {
    assert(typeof TrafficManager[method] === 'function', `${method} should be a function`);
});
console.log("All methods are present.");
