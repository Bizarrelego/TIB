const SpawnLedger = require('./spawnLedger');
const spawnManager = require('./spawnManager');
const planner = require('./planner');
const defense = require('./defense');
const scavengingManager = require('./scavengingManager');
/**
 * O(N) Top-Down Assignment for Early RCL (1-2) Progression.
 * Evaluates room state and assigns exact targets to workers.
 * @param {Room} room - The game room to evaluate.
 * @param {SpawnLedger} _spawnLedger - The virtual ledger for energy capacity tracking.
 */
function manageEarlyProgression(room, _spawnLedger) {
    if (!room.controller || room.controller.level > 2) return;

    const roomCreeps = global.State.creepsByRoom.get(room.name);
    if (!roomCreeps) return;

    const workers = roomCreeps.get('worker') || [];

    // Extract global state (0-CPU cost lookups)
    const sources = global.State.sourcesByRoom.get(room.name) || [];
    const droppedRaw = global.State.droppedByRoom.get(room.name) || [];
    const droppedArrays = droppedRaw instanceof Map ? Array.from(droppedRaw.values()) : droppedRaw;
    const structures = global.State.structuresByRoom.get(room.name) || new Map();
    const sites = global.State.sitesByRoom.get(room.name) || [];
    const tombstonesRaw = global.State.tombstonesByRoom.get(room.name) || [];
    const tombstones = tombstonesRaw instanceof Map ? Array.from(tombstonesRaw.values()) : tombstonesRaw;

    if (!room.heap) room.heap = new Map();
    let harvesterSpots = room.heap.get('harvesterSpots');
    if (!harvesterSpots && sources.length > 0) {
        harvesterSpots = new Map();
        const containers = structures.get(STRUCTURE_CONTAINER) ? Array.from(structures.get(STRUCTURE_CONTAINER).values()) : [];
        for (let i = 0; i < sources.length; i++) {
            const source = sources[i];
            let bestContainer = null;
            let bestPos = null;
            for (let j = 0; j < containers.length; j++) {
                if (containers[j].pos.isNearTo(source)) {
                    bestContainer = containers[j];
                    break;
                }
            }
            if (!bestContainer && sites.length > 0) {
                for (let j = 0; j < sites.length; j++) {
                    if (sites[j].structureType === STRUCTURE_CONTAINER && sites[j].pos.isNearTo(source)) {
                        bestPos = sites[j].pos;
                        break;
                    }
                }
            }
            if (bestContainer) {
                // Pack it: 50x + y
                harvesterSpots.set(source.id, bestContainer.pos.x * 50 + bestContainer.pos.y);
            } else if (bestPos) {
                harvesterSpots.set(source.id, bestPos.x * 50 + bestPos.y);
            }
        }
        room.heap.set('harvesterSpots', harvesterSpots);
    }

    // Distribute exact harvester assignments
    const harvesters = roomCreeps.get('harvester') || [];
    const assignedSpots = new Set();
    // Pass 1: Claim already assigned spots
    for (let i = 0; i < harvesters.length; i++) {
        const creep = harvesters[i];
        if (creep.heap && creep.heap.dropId !== undefined) {
            assignedSpots.add(creep.heap.dropId);
        }
    }

    for (let i = 0; i < harvesters.length; i++) {
        const creep = harvesters[i];
        if (!creep.heap) creep.heap = {};
        if (!creep.heap.targetId && sources.length > 0) {
            creep.heap.targetId = sources[i % sources.length].id;
        }
        if (creep.heap.targetId && creep.heap.dropId === undefined && harvesterSpots && harvesterSpots.has(creep.heap.targetId)) {
            const packedPos = harvesterSpots.get(creep.heap.targetId);
            if (!assignedSpots.has(packedPos)) {
                creep.heap.dropId = packedPos;
                assignedSpots.add(packedPos);
                
                // Top-Down Harvester Container Building
                const x = Math.floor(packedPos / 50);
                const y = packedPos % 50;
                for (let s = 0; s < sites.length; s++) {
                    if (sites[s].structureType === STRUCTURE_CONTAINER && sites[s].pos.x === x && sites[s].pos.y === y) {
                        creep.heap.siteId = sites[s].id;
                        break;
                    }
                }
            }
        }
    }

    if (workers.length === 0) return;

    // Filter structures to PREVENT Parasitic Worker Drain
    const validWithdrawTargets = [];
    for (const [type, structs] of structures.entries()) {
        if (type === STRUCTURE_SPAWN || type === STRUCTURE_EXTENSION) continue; // MUST NOT be assigned
        if (type === STRUCTURE_CONTAINER) {
            for (const s of structs.values()) {
                if (s.store.getUsedCapacity(RESOURCE_ENERGY) > 0) validWithdrawTargets.push(s);
            }
        }
    }
    for (let i = 0; i < tombstones.length; i++) {
        if (tombstones[i].store.getUsedCapacity(RESOURCE_ENERGY) > 0) validWithdrawTargets.push(tombstones[i]);
    }

    // Pre-calculate O(1) arrays and track remaining capacities
    let freeSpawns = [];
    let freeExtensions = [];
    const trackedCapacity = new Map();

    if (structures.get(STRUCTURE_SPAWN)) {
        for (const s of structures.get(STRUCTURE_SPAWN).values()) {
            const free = s.store.getFreeCapacity(RESOURCE_ENERGY);
            if (free > 0) {
                freeSpawns.push(s);
                trackedCapacity.set(s.id, free);
            }
        }
    }
    
    if (structures.get(STRUCTURE_EXTENSION)) {
        for (const e of structures.get(STRUCTURE_EXTENSION).values()) {
            const free = e.store.getFreeCapacity(RESOURCE_ENERGY);
            if (free > 0) {
                freeExtensions.push(e);
                trackedCapacity.set(e.id, free);
            }
        }
    }

    let spawnIndex = 0;
    let extIndex = 0;

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

        // First block: State transition logic
        if (usedCap === 0) {
            if (massiveDrop) creep.heap.state = 'pickup';
            else if (validWithdrawTargets.length > 0) creep.heap.state = 'withdraw';
            else creep.heap.state = 'harvest';
        } else if (freeCap === 0) {
            if (spawnIndex < freeSpawns.length || extIndex < freeExtensions.length) {
                creep.heap.state = 'refill';
            } else if (sites.length > 0) {
                creep.heap.state = 'build';
            } else {
                creep.heap.state = 'upgrade';
            }
        } else if (!creep.heap.state) {
            if (massiveDrop) creep.heap.state = 'pickup';
            else if (validWithdrawTargets.length > 0) creep.heap.state = 'withdraw';
            else creep.heap.state = 'harvest';
        }

        // State exhaustion fallbacks
        if (creep.heap.state === 'refill' && spawnIndex >= freeSpawns.length && extIndex >= freeExtensions.length) {
            creep.heap.state = sites.length > 0 ? 'build' : 'upgrade';
        }
        if (creep.heap.state === 'build' && sites.length === 0) {
            creep.heap.state = 'upgrade';
        }
        if (creep.heap.state === 'pickup' && !massiveDrop) {
            if (validWithdrawTargets.length > 0) creep.heap.state = 'withdraw';
            else creep.heap.state = 'harvest';
        }
        if (creep.heap.state === 'withdraw' && validWithdrawTargets.length === 0) {
            creep.heap.state = massiveDrop ? 'pickup' : 'harvest';
        }

        // Second block: Target assignment logic
        const state = creep.heap.state;
        if (state === 'pickup') {
            creep.heap.targetId = massiveDrop.id;
        } else if (state === 'withdraw') {
            creep.heap.targetId = validWithdrawTargets[0].id;
        } else if (state === 'harvest') {
            let bestSource = null;
            let minSat = Infinity;
            const walkableTilesMap = global.State.sourceWalkableTiles.get(room.name);

            for (let s = 0; s < sources.length; s++) {
                const source = sources[s];
                const maxSat = walkableTilesMap ? (walkableTilesMap.get(source.id) || 1) : Infinity;
                const sat = sourceSaturation.get(source.id);
                
                if (sat < maxSat && sat < minSat) {
                    minSat = sat;
                    bestSource = source;
                }
            }
            if (bestSource) {
                creep.heap.targetId = bestSource.id;
                sourceSaturation.set(bestSource.id, minSat + 1);
            } else {
                creep.heap.targetId = null;
                creep.heap.state = null;
            }
        } else if (state === 'refill') {
            let targetSpawn = null;
            while (spawnIndex < freeSpawns.length) {
                const s = freeSpawns[spawnIndex];
                const rem = trackedCapacity.get(s.id);
                if (rem > 0) {
                    targetSpawn = s;
                    trackedCapacity.set(s.id, rem - usedCap);
                    break;
                } else {
                    spawnIndex++;
                }
            }
            if (!targetSpawn) {
                while (extIndex < freeExtensions.length) {
                    const e = freeExtensions[extIndex];
                    const rem = trackedCapacity.get(e.id);
                    if (rem > 0) {
                        targetSpawn = e;
                        trackedCapacity.set(e.id, rem - usedCap);
                        break;
                    } else {
                        extIndex++;
                    }
                }
            }
            if (targetSpawn) {
                creep.heap.targetId = targetSpawn.id;
            } else {
                creep.heap.state = sites.length > 0 ? 'build' : 'upgrade';
                if (creep.heap.state === 'build') creep.heap.targetId = sites[0].id;
                else if (room.controller) creep.heap.targetId = room.controller.id;
            }
        } else if (state === 'build') {
            if (sites.length > 0) creep.heap.targetId = sites[0].id;
        } else if (state === 'upgrade') {
            if (room.controller) creep.heap.targetId = room.controller.id;
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
