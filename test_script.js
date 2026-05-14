const assert = require('assert');

// Mock Game
global.Game = {
    time: 1,
    rooms: {},
    map: { describeExits: () => ({}) },
    cpu: { getUsed: () => 1, bucket: 10000 }
};

// Mock global.State
global.State = {
    spawnsByRoom: new Map(),
    creepsByRoom: new Map(),
    structuresByRoom: new Map(),
    sitesByRoom: new Map(),
    intel: new Map(),
    sourcesByRoom: new Map()
};

// Mock Constants
global.OK = 0;
global.ERR_BUSY = -4;
global.ERR_NOT_ENOUGH_ENERGY = -6;
global.STRUCTURE_LINK = 'link';
global.STRUCTURE_STORAGE = 'storage';
global.STRUCTURE_SPAWN = 'spawn';
global.STRUCTURE_EXTENSION = 'extension';
global.STRUCTURE_TOWER = 'tower';
global.STRUCTURE_OBSERVER = 'observer';
global.STRUCTURE_POWER_SPAWN = 'powerSpawn';
global.STRUCTURE_EXTRACTOR = 'extractor';
global.STRUCTURE_TERMINAL = 'terminal';
global.STRUCTURE_LAB = 'lab';
global.STRUCTURE_NUKER = 'nuker';
global.STRUCTURE_FACTORY = 'factory';
global.STRUCTURE_ROAD = 'road';
global.CARRY = 'carry';
global.MOVE = 'move';
global.WORK = 'work';
global.CLAIM = 'claim';
global.ATTACK = 'attack';
global.HEAL = 'heal';
global.TOUGH = 'tough';
global.RANGED_ATTACK = 'ranged_attack';
global.BODYPART_COST = { carry: 50, move: 50, work: 100, claim: 600, attack: 80 };

const SpawnLedger = require('./src/colonies/spawnLedger');
const SpawnQueueManager = require('./src/managers/SpawnQueueManager');
const spawnManager = require('./src/colonies/spawnManager');

function test() {
    let spawnCalledCount = 0;

    // Mock room and spawn
    const room = {
        name: 'W1N1',
        energyAvailable: 300,
        energyCapacityAvailable: 300,
        controller: { level: 2, my: true }
    };

    const spawn = {
        id: 'spawn1',
        room: room,
        spawning: null,
        spawnCreep: function(body, name, opts) {
            spawnCalledCount++;
            return OK;
        }
    };

    global.State.spawnsByRoom.set('W1N1', [spawn]);
    global.State.creepsByRoom.set('W1N1', new Map()); // No creeps yet
    global.State.sourcesByRoom.set('W1N1', [{ id: 'source1' }]);

    const ledger = new SpawnLedger(room);
    spawnManager.run(room, ledger);

    assert(spawnCalledCount === 1, "Spawn should be called exactly once because energy runs out or spawn gets busy");
    assert(ledger.getAvailableEnergy() < 300, "Energy should have been reserved");
    console.log("Tests pass!");
}

test();
