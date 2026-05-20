const SpawnLedger = require('./spawnLedger');
const defense = require('./defense');
const scavengingManager = require('./scavengingManager');

/**
 * O(N) Top-Down Assignment for Early RCL (1-2) Progression.
 * Evaluates room state and assigns exact targets to workers.
 * @param {Room} room - The game room to evaluate.
 * @param {SpawnLedger} _spawnLedger - The virtual ledger for energy capacity tracking.
 */
function manageEarlyProgression(room, _spawnLedger) {
    if (!room.controller || room.controller.level > 3) return;

    const roomCreeps = global.State.creepsByRoom.get(room.name);
    if (!roomCreeps) return;

    // Maintain harvester assignments
    const sources = global.State.sourcesByRoom.get(room.name) || [];
    const harvesters = roomCreeps.get('harvester') || [];

    for (let i = 0; i < harvesters.length; i++) {
        const creep = harvesters[i];
        if (!creep.heap) creep.heap = {};
        if (!creep.heap.targetId && sources.length > 0) {
            creep.heap.targetId = sources[i % sources.length].id;
        }
    }

    if (room.controller.level === 3 && room.energyAvailable >= room.energyCapacityAvailable - 50) {
        global.State.aggressionState = 'Expansion';
        if (global.State.intel) {
            const intelArray = Array.from(global.State.intel.entries());
            let bestRoom = null;
            let highestScore = 0;

            for (const [roomName, data] of intelArray) {
                if (data.expansionScore && data.expansionScore > highestScore) {
                    highestScore = data.expansionScore;
                    bestRoom = roomName;
                }
            }

            if (bestRoom) {
                const SpawnQueueManager = require('../managers/SpawnQueueManager');
                if (SpawnQueueManager.getQueuedCount(room.name, 'reserver', bestRoom) === 0) {
                    const body = room.energyCapacityAvailable >= 1300 ? [CLAIM, CLAIM, MOVE, MOVE] : [CLAIM, MOVE];
                    const cost = room.energyCapacityAvailable >= 1300 ? 1300 : 650;
                    SpawnQueueManager.requestSpawn(room.name, 'reserver', body, 'claimer_' + Game.time, { memory: { role: 'reserver', colony: room.name, targetRoom: bestRoom, claimFlag: true } }, cost);
                }
            }
        }
    }
}

/**
 * Executes core colony management loop.
 * Instantiates the SpawnLedger to track energy use during the tick,
 * passing it as a singleton-like service to spawnManager.
 */
module.exports = { run: function colonyManager() {
    if (!global.State || !global.State.rooms) return;
    for (const room of global.State.rooms.values()) {
        if (room.controller && room.controller.my === true) {
            try {
                // Instantiate SpawnLedger globally for the room per tick
                const spawnLedger = new SpawnLedger(room);
                
                defense.run(room);
                scavengingManager.run(room);
                
                manageEarlyProgression(room, spawnLedger);

                if (room.controller && room.controller.level >= 1 && room.controller.level <= 4) {
                    const sites = global.State.sitesByRoom.get(room.name);
                    const roomCreeps = global.State.creepsByRoom.get(room.name);
                    if (roomCreeps) {
                        const upgraders = roomCreeps.get('upgrader');
                        if (upgraders) {
                            const hasSites = sites && sites.length > 0;
                            for (let i = 0; i < upgraders.length; i++) {
                                if (!upgraders[i].heap) upgraders[i].heap = {};
                                upgraders[i].heap.overrideTask = hasSites ? 'build' : undefined;
                            }
                        }
                    }
                }

            } catch (e) {
                console.log(`[ColonyManager Error] Room ${room.name}: ${e.stack}`);
            }
        }
    }
} };