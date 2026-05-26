/**
 * @file RCLProgressionManager.js
 * @description Manages RCL progression logic for colonies.
 */

const { wrapManager } = require('../utils/ManagerErrorBoundary');

const BootstrapPlanner = require('./BootstrapPlanner');
const earlyGameConstructionPlanner = require('./earlyGameConstructionPlanner');
const RCL3RemoteOps = require('./RCL3RemoteOps');
const RCL4HubManager = require('./RCL4HubManager');
const HarassmentManager = require('../operations/HarassmentManager');
const RemoteHaulerOptimizer = require('./RemoteHaulerOptimizer');

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
        if (!creep.heap.targetSourceId && sources.length > 0) {
            creep.heap.targetSourceId = sources[i % sources.length].id;
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
 * Runs the RCL progression logic for a given room.
 * @param {Room} _room - The room to process.
 */
function run(_room) {
    if (!_room.controller || !_room.controller.my) return;

    const rcl = _room.controller.level;

    let plannerState = null;
    if (global.State && (rcl === 1 || rcl === 2)) {
        global.State.roomPlanner = global.State.roomPlanner || new Map();
        if (!global.State.roomPlanner.has(_room.name)) {
            global.State.roomPlanner.set(_room.name, new Map());
        }
        plannerState = global.State.roomPlanner.get(_room.name);
    }

    if (rcl === 1) {
        if (plannerState) BootstrapPlanner.planStructures(_room, plannerState);
        manageEarlyProgression(_room, null);
    } else if (rcl === 2) {
        if (plannerState) BootstrapPlanner.planStructures(_room, plannerState);
        earlyGameConstructionPlanner.getRCL2ExtensionPositions(_room);
        manageEarlyProgression(_room, null);
    } else if (rcl === 3) {
        RCL3RemoteOps.run(_room);
        if (typeof HarassmentManager === 'function') {
            HarassmentManager();
        } else if (HarassmentManager && typeof HarassmentManager.run === 'function') {
            HarassmentManager.run();
        }
        manageEarlyProgression(_room, null);
    } else if (rcl === 4) {
        RCL4HubManager.run(_room);
        if (RemoteHaulerOptimizer && typeof RemoteHaulerOptimizer.run === 'function') {
            RemoteHaulerOptimizer.run(_room);
        }
    }
}

module.exports = {
    run: wrapManager(run, 'RCLProgressionManager')
};
