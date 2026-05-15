const TrafficManager = require('./src/traffic/trafficManager.js');

global.State = {
    pipelineLedger: new Map(),
    ledger: new Map()
};
global.Game = { time: 1 };
global.ERR_BUSY = -4;
global.ERR_FULL = -8;
global.OK = 0;
global.RESOURCE_ENERGY = 'energy';

const creep = {
    name: 'creep1',
    id: 'c1',
    store: { getUsedCapacity: () => 10, getCapacity: () => 50 }
};

const target = {
    id: 't1',
    store: { getUsedCapacity: () => 0, getCapacity: () => 50 }
};

console.log("Before transfer:", global.State.pipelineLedger.size);
TrafficManager.registerTransfer(creep, target, RESOURCE_ENERGY, 10);
console.log("After transfer:", global.State.pipelineLedger.size);
console.log("Has lockPipeline?", typeof TrafficManager.lockPipeline === 'function');
