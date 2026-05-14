const Profiler = require('../utils/profiler');
/**
 * @file scoutManager.js
 * @description Manages scouting targets, intel gathering (sources, SK, highways, structures), and expansion scoring.
 */

function getAdjacentRooms(roomName) {
    const coords = roomName.match(/([WE])([0-9]+)([NS])([0-9]+)/);
    let hDir = coords[1];
    let x = parseInt(coords[2], 10);
    let vDir = coords[3];
    let y = parseInt(coords[4], 10);
    const neighbors = [];

    const getNextCoord = (dir, val, delta) => {
        let newVal = val + delta;
        if (newVal < 0) {
            newVal = Math.abs(newVal) - 1;
            dir = dir === 'W' ? 'E' : (dir === 'E' ? 'W' : (dir === 'N' ? 'S' : 'N'));
        }
        return dir + newVal;
    };

    neighbors.push(getNextCoord(hDir, x, 0) + getNextCoord(vDir, y, -1)); // TOP
    neighbors.push(getNextCoord(hDir, x, 1) + getNextCoord(vDir, y, 0)); // RIGHT
    neighbors.push(getNextCoord(hDir, x, 0) + getNextCoord(vDir, y, 1)); // BOTTOM
    neighbors.push(getNextCoord(hDir, x, -1) + getNextCoord(vDir, y, 0)); // LEFT

    return neighbors;
}

/**
 * Determines a room's type (highway, SK, center, regular) based on coordinate math.
 * @param {string} roomName - The name of the room.
 * @returns {string} The computed room type.
 */
function getRoomType(roomName) {
    const coords = roomName.match(/[a-zA-Z]+|[0-9]+/g);
    const x = parseInt(coords[1], 10);
    const y = parseInt(coords[3], 10);

    if (x % 10 === 0 || y % 10 === 0) return 'highway';
    if (x % 10 >= 4 && x % 10 <= 6 && y % 10 >= 4 && y % 10 <= 6) return 'sk';
    if (x % 10 === 5 && y % 10 === 5) return 'center';
    return 'regular';
}

/**
 * Gathers current state info for a room and persists it to global.State.intel.
 * Logs sources, minerals, structures, and controllers.
 * @param {string} roomName - The name of the room to gather intel from.
 * @returns {void}
 */
function gatherIntel(roomName) {
    if (!global.State) return;
    if (!global.State.intel) global.State.intel = new Map();

    let intel = global.State.intel.get(roomName);
    if (!intel) {
        intel = {};
        global.State.intel.set(roomName, intel);
    }

    if (!global.State.scannedRooms || !global.State.scannedRooms.has(roomName)) return; // Only gather if vision

    intel.lastSeen = Game.time;
    intel.type = getRoomType(roomName);

    if (intel.type === 'regular' || intel.type === 'sk') {
        const sources = global.State.sourcesByRoom.get(roomName) || [];
        intel.sources = sources.length;

        const minerals = global.State.mineralsByRoom.get(roomName) || [];
        const mineral = minerals[0];
        if (mineral) {
            intel.mineral = mineral.mineralType;
        }

        const roomStructuresMap = global.State.structuresByRoom.get(roomName);
        let structureCount = 0;

        if (intel.type === 'sk') {
            const lairsMap = roomStructuresMap ? roomStructuresMap.get(STRUCTURE_KEEPER_LAIR) : null;
            intel.skLairs = lairsMap ? (lairsMap instanceof Map ? lairsMap.size : lairsMap.length) : 0;
        }

        if (roomStructuresMap) {
            for (const structures of roomStructuresMap.values()) {
                structureCount += (structures instanceof Map ? structures.size : structures.length);
            }
        }
        intel.structureCount = structureCount;

        const controller = global.State.controllersByRoom.get(roomName);
        if (controller) {
            if (controller.owner) {
                intel.owner = controller.owner.username;
                intel.hostile = !controller.my;
            } else if (controller.reservation) {
                intel.reservation = controller.reservation.username;
                intel.hostile = controller.reservation.username !== 'jules'; // placeholder for own username
            } else {
                intel.owner = null;
                intel.reservation = null;
                intel.hostile = false;
            }

            // Score logic for expansion
            if (!intel.hostile && intel.type === 'regular' && intel.sources >= 2) {
                let score = 100;
                // Prefer rooms with multiple sources and a mineral
                if (intel.mineral) score += 50;

                intel.expansionScore = score;
            } else {
                intel.expansionScore = 0;
            }
        }
    } else if (intel.type === 'highway') {
        const roomStructuresMap = global.State.structuresByRoom.get(roomName);
        const portalsMap = roomStructuresMap ? roomStructuresMap.get(STRUCTURE_PORTAL) : null;
        intel.portals = portalsMap ? (portalsMap instanceof Map ? portalsMap.size > 0 : portalsMap.length > 0) : false;

        // Can track power banks and deposits in the future
    }
}

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
            const neighbors = getAdjacentRooms(currentRoom);

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
                    gatherIntel(scout.room.name);
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
module.exports = Profiler.wrap('scoutManager', function scoutManager() {
    try {
        // Run scouts every tick to assign targets and gather intel
        runScouts();

        // Also gather intel on our own rooms where we have vision naturally
        if (Game.time % 100 === 0 && global.State.scannedRooms) {
            for (const roomName of global.State.scannedRooms) {
                gatherIntel(roomName);
            }
        }
    } catch (e) {
        console.error(`[ScoutManager Error] ${e.stack}`);
    }
});
