const Profiler = require('../utils/profiler');
const { wrapModuleFunctions } = require('../utils/moduleWrapper');
const { executeManager } = require('../utils/errorHandler');
const intelManager = require('./intel');
/**
 * @file scoutManager.js
 * @description Manages scouting targets, intel gathering (sources, SK, highways, structures), and expansion scoring.
 */

/**
 * Determines the next best room for a scout to visit using BFS.
 * @param {Creep} scoutCreep - The scout creep.
 * @returns {string|null} The name of the target room, or null if none found.
 */
function getScoutTarget(scoutCreep) {
    if (!global.State) return null;
    if (!global.State.intel) global.State.intel = new Map();

    const queue = [scoutCreep.room.name];
    const visited = new Set();
    visited.add(scoutCreep.room.name);

    const maxDistance = 15;
    let depth = 0;

    const highScores = [];
    const staleRooms = [];

    while (queue.length > 0 && depth < maxDistance) {
        const levelSize = queue.length;
        for (let i = 0; i < levelSize; i++) {
            const currentRoom = queue.shift();
            // FIX: Use Game.map directly to prevent silent intelManager failures
            const neighborsObj = Game.map.describeExits(currentRoom);
            const neighbors = neighborsObj ? Object.values(neighborsObj) : [];

            for (let j = 0; j < neighbors.length; j++) {
                const neighborRoom = neighbors[j];

                if (!visited.has(neighborRoom)) {
                    visited.add(neighborRoom);
                    queue.push(neighborRoom);

                    const intel = global.State.intel.get(neighborRoom);

                    // Priority 1: Unseen room
                    if (!intel || !intel.lastSeen) {
                        return neighborRoom;
                    }

                    // Priority 2: High expansion score
                    if (intel.expansionScore && intel.expansionScore > 0) {
                        highScores.push({ roomName: neighborRoom, score: intel.expansionScore, distance: depth + 1 });
                    }

                    // Priority 3: Stale intel
                    if (Game.time - intel.lastSeen > 1000) {
                        staleRooms.push({ roomName: neighborRoom, age: Game.time - intel.lastSeen, distance: depth + 1 });
                    }
                }
            }
        }
        depth++;
    }

    // Sort and return Priority 2 if available
    if (highScores.length > 0) {
        highScores.sort((a, b) => b.score - a.score || a.distance - b.distance);
        return highScores[0].roomName;
    }

    // Sort and return Priority 3 if available
    if (staleRooms.length > 0) {
        staleRooms.sort((a, b) => b.age - a.age || a.distance - b.distance);
        return staleRooms[0].roomName;
    }

    return null;
}

/**
 * Iterates all scouts globally to process their intel gathering and target assignments.
 * @returns {void}
 */
function runScouts() {
    const allCreeps = global.State.creepsByRoom;
    if (!allCreeps) return;

    for (const [, roomCreeps] of allCreeps.entries()) {
        const scouts = roomCreeps.get('scout');
        if (scouts && scouts.length > 0) {
            for (const scout of scouts) {
                // If the scout is in a room, gather intel
                if (scout.room) {
                    intelManager.gatherIntel(scout.room.name);

                    if (global.State.intel && global.State.intel.has(scout.room.name) && global.State.intel.get(scout.room.name).harassmentTarget) {
                        const SpawnQueueManager = require('../managers/SpawnQueueManager');
                        const cost = BODYPART_COST[WORK] + BODYPART_COST[MOVE];
                        if (SpawnQueueManager.getQueuedCount(scout.memory.colony, 'soloDismantler', scout.room.name) === 0) {
                            SpawnQueueManager.requestSpawn(scout.memory.colony, 'soloDismantler', [WORK, MOVE], 'dismantle_' + Game.time, { memory: { role: 'soloDismantler', colony: scout.memory.colony, targetRoom: scout.room.name } }, cost);
                        }
                    }
                }

                // If the scout doesn't have a target, assign one
                if (!scout.heap.targetRoom) {
                    const target = getScoutTarget(scout);
                    if (target) {
                        scout.heap.targetRoom = target;
                        scout.heap.path = null; // Clear path cache for the new target
                    }
                }
            }
        }
    }
}

/**
 * Main scout manager loop to process global scout assignments.
 * @returns {void}
 */
const exportedModule = Profiler.wrap('scoutManager', function scoutManager() {
    // Run scouts every tick to assign targets and gather intel
        runScouts();

        // Also gather intel on our own rooms where we have vision naturally
        if (Game.time % 100 === 0 && global.State.scannedRooms) {
            for (const roomName of global.State.scannedRooms) {
                intelManager.gatherIntel(roomName);
            }
        }
});

module.exports = wrapModuleFunctions(exportedModule, (funcName, originalFunc, ...args) => executeManager(`scoutManager.${funcName}`, originalFunc, ...args));
