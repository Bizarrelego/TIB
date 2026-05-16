const SpawnLedger = require('./spawnLedger');
const spawnManager = require('./spawnManager');
const planner = require('./planner');
const defense = require('./defense');
const scavengingManager = require('./scavengingManager');
const SpawnQueueManager = require('../managers/SpawnQueueManager');
const BodyCalc = require('../utils/bodyCalc');

/**
 * O(N) Top-Down Assignment for Early RCL (1-2) Progression.
 * Evaluates room state and assigns exact targets to workers.
 * @param {Room} room - The game room to evaluate.
 * @param {SpawnLedger} spawnLedger - The virtual ledger for energy capacity tracking.
 */
function manageEarlyProgression(room, spawnLedger) {
    if (!room.controller || room.controller.level > 2) return;

    const roomCreeps = global.State.creepsByRoom.get(room.name);
    if (!roomCreeps) return;

    const workers = roomCreeps.get('worker') || [];
    const emergencyBuilders = roomCreeps.get('emergencyBuilder') || [];
    const haulers = roomCreeps.get('hauler') || [];

    // Manager Communication: Check virtual room energy capacity to prevent engine rejections
    const energyAvailable = spawnLedger.getAvailableEnergy();

    if (workers.length === 0 && haulers.length === 0 && emergencyBuilders.length === 0 && energyAvailable >= 200) {
        if (spawnLedger.canSpawn(200)) {
            SpawnQueueManager.requestSpawn(room.name, 'emergencyBuilder', [WORK, CARRY, MOVE], 'eb_' + Game.time, { memory: { role: 'emergencyBuilder', colony: room.name } }, 200);
            spawnLedger.reserveEnergy(200);
        }
    } else if (workers.length < 15 && energyAvailable >= 200) {
        const body = BodyCalc.calculateWorker(room.energyCapacityAvailable);
        const cost = BodyCalc.getCost(body);
        if (spawnLedger.canSpawn(cost)) {
            SpawnQueueManager.requestSpawn(room.name, 'worker', body, 'worker_' + Game.time, { memory: { role: 'worker', colony: room.name } }, cost);
            spawnLedger.reserveEnergy(cost);
        }
    }

    if (workers.length === 0) return;

    // Extract global state (0-CPU cost lookups)
    const sources = global.State.sourcesByRoom.get(room.name) || [];
    const droppedArrays = global.State.droppedByRoom.get(room.name) || [];
    const structures = global.State.structuresByRoom.get(room.name) || new Map();
    const spawnStructures = structures.get(STRUCTURE_SPAWN) ? Array.from(structures.get(STRUCTURE_SPAWN).values()) : [];
    const extensions = structures.get(STRUCTURE_EXTENSION) ? Array.from(structures.get(STRUCTURE_EXTENSION).values()) : [];
    const sites = global.State.sitesByRoom.get(room.name) || [];

    let massiveDrop = null;
    for (let i = 0; i < droppedArrays.length; i++) {
        if (droppedArrays[i].amount >= 300 && (!droppedArrays[i].resourceType || droppedArrays[i].resourceType === RESOURCE_ENERGY)) {
            massiveDrop = droppedArrays[i];
            break;
        }
    }

    // V8 Map Optimization: Use Map() for O(1) lookups to track saturation.
    const sourceSaturation = new Map();
    for (let i = 0; i < sources.length; i++) sourceSaturation.set(sources[i].id, 0);

    for (let i = 0; i < workers.length; i++) {
        const creep = workers[i];
        if (creep.fatigue > 0) continue; // Fatigue gating

        if (!creep.heap) creep.heap = {};

        const usedCap = creep.store.getUsedCapacity(RESOURCE_ENERGY);
        const freeCap = creep.store.getFreeCapacity(RESOURCE_ENERGY);

        if (usedCap === 0) {
            if (massiveDrop) {
                creep.heap.state = 'pickup';
                creep.heap.targetId = massiveDrop.id;
            } else {
                creep.heap.state = 'harvest';
                let bestSource = sources[0];
                let minSat = Infinity;
                for (let s = 0; s < sources.length; s++) {
                    const sat = sourceSaturation.get(sources[s].id);
                    if (sat < minSat) {
                        minSat = sat;
                        bestSource = sources[s];
                    }
                }
                if (bestSource) {
                    creep.heap.targetId = bestSource.id;
                    sourceSaturation.set(bestSource.id, minSat + 1);
                }
            }
        } else if (freeCap === 0 || creep.heap.state === 'refill' || creep.heap.state === 'build' || creep.heap.state === 'upgrade') {
            let targetSpawn = spawnStructures.find(s => s.store.getFreeCapacity(RESOURCE_ENERGY) > 0);
            if (!targetSpawn) {
                targetSpawn = extensions.find(e => e.store.getFreeCapacity(RESOURCE_ENERGY) > 0);
            }

            if (targetSpawn) {
                creep.heap.state = 'refill';
                creep.heap.targetId = targetSpawn.id;
            } else if (sites.length > 0) {
                creep.heap.state = 'build';
                creep.heap.targetId = sites[0].id;
            } else {
                creep.heap.state = 'upgrade';
                if (room.controller) creep.heap.targetId = room.controller.id;
            }
        }
    }
}

/**
 * Executes core colony management loop.
 * Instantiates the SpawnLedger to track energy use during the tick,
 * passing it as a singleton-like service to spawnManager.
 */
module.exports = function colonyManager() {
    for (const room of Object.values(Game.rooms)) {
        if (room.controller && room.controller.my === true) {
            try {
                // Instantiate SpawnLedger globally for the room per tick
                const spawnLedger = new SpawnLedger(room);
                spawnManager.run(room, spawnLedger);
                
                planner.run(room);
                defense.run(room);
                scavengingManager.run(room);
                
                manageEarlyProgression(room, spawnLedger);

                // IMPROVEMENT: Removed all direct role executions (worker.run, hauler.run, etc.).
                // Reason: Consolidates execution hierarchy. Roles are now exclusively ticked via managerOrchestrator.js to respect tick-slicing and CPU bucket constraints.
            } catch (e) {
                console.log(`[ColonyManager Error] Room ${room.name}: ${e.stack}`);
            }
        }
    }
};
