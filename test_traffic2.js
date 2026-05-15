const assert = require('assert');

global.Game = {
    time: 100,
    getObjectById: (id) => global.State.objects[id]
};
global.RESOURCE_ENERGY = 'energy';
global.ERR_BUSY = -4;
global.ERR_FULL = -8;
global.ERR_NOT_ENOUGH_RESOURCES = -6;
global.OK = 0;

global.State = { objects: {} };

const TrafficManager = require('./src/traffic/trafficManager.js');

TrafficManager.run(); // initializes the maps

// test that pipeline cleanup works
TrafficManager.lockPipeline('creep1', 'source1', 'target1', RESOURCE_ENERGY, 50, 'TRANSFER');
assert(global.State.pipelineLedger.has('source1'));
assert.strictEqual(global.State.pipelineLedger.get('source1').tickExpiry, 101);

Game.time = 102;
TrafficManager.run(); // this should clean up expired pipeline locks
assert(!global.State.pipelineLedger.has('source1'));

console.log('Passed');
