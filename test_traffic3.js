const assert = require('assert');
global.Game = { time: 100, getObjectById: () => null };
global.RESOURCE_ENERGY = 'energy';
global.ERR_BUSY = -4; global.ERR_FULL = -8; global.ERR_NOT_ENOUGH_RESOURCES = -6; global.OK = 0;
global.State = { objects: {} };
const TrafficManager = require('./src/traffic/trafficManager.js');

TrafficManager.run();

const creep = {
    id: 'creep1',
    store: {
        getUsedCapacity: () => 50,
        getCapacity: () => 100
    }
};

const target = {
    id: 'target1',
    amount: 50 // dropped resource
};

TrafficManager.registerPickup(creep, target, RESOURCE_ENERGY, 25);
let targetState = TrafficManager.getVirtualState(target, RESOURCE_ENERGY);
let creepState = TrafficManager.getVirtualState(creep, RESOURCE_ENERGY);

assert.strictEqual(targetState.used, 25);
assert.strictEqual(creepState.used, 75);
console.log('Pickup test passed');
