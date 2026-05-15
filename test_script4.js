const assert = require('assert');
const TrafficManager = require('./src/traffic/trafficManager');

// Mock Screeps globals
global.Game = { time: 1 };
global.RESOURCE_ENERGY = 'energy';
global.ERR_NOT_ENOUGH_RESOURCES = -6;
global.ERR_FULL = -8;
global.OK = 0;

TrafficManager.init();

const storeTarget = { id: 's2', store: { getUsedCapacity: () => 50, getCapacity: () => 100 } };
const storeState = TrafficManager.getVirtualState(storeTarget, global.RESOURCE_ENERGY);

assert.strictEqual(storeState.used, 50);
assert.strictEqual(storeState.free, 50);
assert.strictEqual(storeState.cap, 100);

console.log("Testing Intent Registrations chain...");
const creep = { name: 'c1', id: 'cid1', store: { getUsedCapacity: () => 0, getCapacity: () => 50 } };
const source = { id: 'src2', energy: 1000, energyCapacity: 3000 };

TrafficManager.registerHarvest(creep, source, 10);

// Should now update correctly
const creepStatePostHarvest = TrafficManager.getVirtualState(creep, global.RESOURCE_ENERGY);
assert.strictEqual(creepStatePostHarvest.used, 10);
assert.strictEqual(creepStatePostHarvest.free, 40);
assert.strictEqual(creepStatePostHarvest.cap, 50);
console.log("All tests passed!");
