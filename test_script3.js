const assert = require('assert');
const TrafficManager = require('./src/traffic/trafficManager');

// Mock Screeps globals
global.Game = { time: 1 };
global.RESOURCE_ENERGY = 'energy';
global.ERR_NOT_ENOUGH_RESOURCES = -6;
global.ERR_FULL = -8;
global.OK = 0;

TrafficManager.init();

console.log("Testing getVirtualState for Store...");
const storeTarget = { id: 's1', store: { getUsedCapacity: () => 50, getCapacity: () => 100 } };
const storeState = TrafficManager.getVirtualState(storeTarget, global.RESOURCE_ENERGY);
assert.strictEqual(storeState.used, 50);
assert.strictEqual(storeState.free, 50);

console.log("Testing getVirtualState for Dropped Resource...");
const dropTarget = { id: 'd1', amount: 30 };
const dropState = TrafficManager.getVirtualState(dropTarget, global.RESOURCE_ENERGY);
assert.strictEqual(dropState.used, 30);
assert.strictEqual(dropState.free, 0);

console.log("Testing getVirtualState for Source...");
const sourceTarget = { id: 'src1', energy: 1500, energyCapacity: 3000 };
const sourceState = TrafficManager.getVirtualState(sourceTarget, global.RESOURCE_ENERGY);
assert.strictEqual(sourceState.used, 1500);
assert.strictEqual(sourceState.free, 1500);

console.log("Testing Intent Registrations...");
const creep = { name: 'c1', id: 'cid1', store: { getUsedCapacity: () => 0, getCapacity: () => 50 } };
const source = { id: 'src2', energy: 1000, energyCapacity: 3000 };

// Test Harvest Registration
const result = TrafficManager.registerHarvest(creep, source, 10);
assert.strictEqual(result, global.OK);

// Check Pipeline Ledger
const pipelineLock = global.State.pipelineLedger.get(creep.id);
assert(pipelineLock, "Pipeline lock should be created");
assert.strictEqual(pipelineLock.type, 'HARVEST');
assert.strictEqual(pipelineLock.amount, 10);

console.log("All tests passed!");
