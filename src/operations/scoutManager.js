/**
 * @file scoutManager.js
 * @description Manages scouting targets, intel gathering (sources, SK, highways, structures), and expansion scoring.
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

function gatherIntel(roomName) {
    if (!global.State) return;
    if (!global.State.intel) global.State.intel = new Map();

    let intel = global.State.intel.get(roomName);
    if (!intel) {
        intel = {};
        global.State.intel.set(roomName, intel);
    }

    const room = Game.rooms[roomName];
    if (!room) return; // Only gather intel if we have vision

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

function getScoutTarget(scoutCreep) {
    if (!global.State) return null;
    if (!global.State.intel) global.State.intel = new Map();

    // Breadth-first search to find the nearest room that needs scouting
    const queue = [scoutCreep.room.name];
    const visited = new Set();
    visited.add(scoutCreep.room.name);

    let bestTarget = null;
    let maxDistance = 15; // Max depth to search
    let depth = 0;

    while (queue.length > 0 && depth < maxDistance) {
        let levelSize = queue.length;
        for (let i = 0; i < levelSize; i++) {
            const currentRoom = queue.shift();
            const exits = Game.map.describeExits(currentRoom);

            if (exits) {
                for (const direction in exits) {
                    const neighborRoom = exits[direction];

                    if (!visited.has(neighborRoom)) {
                        visited.add(neighborRoom);
                        queue.push(neighborRoom);

                        const intel = global.State.intel.get(neighborRoom);

                        // If we have never seen it, or haven't seen it in 5000 ticks, it's a good target
                        if (!intel || !intel.lastSeen || (Game.time - intel.lastSeen > 5000)) {
                            return neighborRoom;
                        }
                    }
                }
            }
        }
        depth++;
    }

    return bestTarget;
}

function runScouts() {
    const allCreeps = global.State.creepsByRoom;
    if (!allCreeps) return;

    for (const [roomName, roomCreeps] of allCreeps.entries()) {
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

module.exports = function scoutManager() {
    try {
        // Run scouts every tick to assign targets and gather intel
        runScouts();

        // Also gather intel on our own rooms where we have vision naturally
        if (Game.time % 100 === 0) {
            for (const roomName in Game.rooms) {
                gatherIntel(roomName);
            }
        }
    } catch (e) {
        console.error(`[ScoutManager Error] ${e.stack}`);
    }
};
