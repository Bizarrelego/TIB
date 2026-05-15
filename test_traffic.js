const assert = require('assert');

// Mock Game
global.Game = {
    time: 100,
    getObjectById: (id) => global.State.objects[id]
};

// Mock constants
global.RESOURCE_ENERGY = 'energy';
global.ERR_BUSY = -4;
global.ERR_FULL = -8;
global.ERR_NOT_ENOUGH_RESOURCES = -6;
global.OK = 0;

global.State = {
    objects: {},
    trafficIntents: new Map(),
    ledger: new Map(),
    swapRegistry: new Map(),
    pipelineLedger: new Map()
};

const TrafficManager = require('./src/traffic/trafficManager.js');

TrafficManager.init();

// Set up mock objects
const creep = {
    id: 'creep1',
    name: 'creep1',
    store: {
        getUsedCapacity: () => 50,
        getCapacity: () => 100
    }
};

const target = {
    id: 'target1',
    store: {
        getUsedCapacity: () => 100,
        getCapacity: () => 200
    }
};

global.State.objects['creep1'] = creep;
global.State.objects['target1'] = target;

console.log('Testing TrafficManager ledger...');

let result = TrafficManager.registerTransfer(creep, target, RESOURCE_ENERGY, 50);
assert.strictEqual(result, OK, 'Transfer 50 should be OK');

let targetState = TrafficManager.getVirtualState(target, RESOURCE_ENERGY);
assert.strictEqual(targetState.used, 150, 'Target used should be 150');

let creepState = TrafficManager.getVirtualState(creep, RESOURCE_ENERGY);
assert.strictEqual(creepState.used, 0, 'Creep used should be 0');

// Mock creep2 for testing ERR_FULL
const creep2 = {
    id: 'creep2',
    name: 'creep2',
    store: {
        getUsedCapacity: () => 50,
        getCapacity: () => 100
    }
};
global.State.objects['creep2'] = creep2;

result = TrafficManager.registerTransfer(creep2, target, RESOURCE_ENERGY, 60);
assert.strictEqual(result, ERR_FULL, 'Transfer 60 should be ERR_FULL');

console.log('Test passed!');
