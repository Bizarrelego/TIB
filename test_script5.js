const assert = require('assert');
const TrafficManager = require('./src/traffic/trafficManager');

// Mock globals
global.Game = { time: 1 };
global.RESOURCE_ENERGY = 'energy';
global.RESOURCE_UTRIUM = 'U';
global.ERR_NOT_ENOUGH_RESOURCES = -6;
global.ERR_FULL = -8;
global.OK = 0;

TrafficManager.init();

console.log("Testing Mineral getVirtualState...");
const mineralTarget = { id: 'm1', mineralAmount: 500, mineralType: global.RESOURCE_UTRIUM };
const mineralState = TrafficManager.getVirtualState(mineralTarget, global.RESOURCE_UTRIUM);
assert.strictEqual(mineralState.used, 500);
assert.strictEqual(mineralState.free, 0);
assert.strictEqual(mineralState.cap, 500);

console.log("Testing Intent Registration for non-energy (Pickup)...");
const creep = { name: 'c1', id: 'cid1', store: { getUsedCapacity: () => 0, getCapacity: () => 50 } };
const droppedUtrium = { id: 'd1', amount: 30, resourceType: global.RESOURCE_UTRIUM };

const res = TrafficManager.registerPickup(creep, droppedUtrium, 15);
assert.strictEqual(res, global.OK);

const pipelineLock = global.State.pipelineLedger.get(creep.id);
assert.strictEqual(pipelineLock.resourceType, global.RESOURCE_UTRIUM);
assert.strictEqual(pipelineLock.amount, 15);

console.log("All tests passed!");
