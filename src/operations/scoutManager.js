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
    if (!Memory.intel) Memory.intel = {};
    if (!Memory.intel[roomName]) Memory.intel[roomName] = {};

    const room = Game.rooms[roomName];
    if (!room) return; // Only gather intel if we have vision

    const intel = Memory.intel[roomName];
    intel.lastSeen = Game.time;
    intel.type = getRoomType(roomName);

    if (intel.type === 'regular' || intel.type === 'sk') {
        const sources = room.find(FIND_SOURCES);
        intel.sources = sources.length;

        const mineral = room.find(FIND_MINERALS)[0];
        if (mineral) {
            intel.mineral = mineral.mineralType;
        }

        if (intel.type === 'sk') {
            const lairs = room.find(FIND_STRUCTURES, {
                filter: s => s.structureType === STRUCTURE_KEEPER_LAIR
            });
            intel.skLairs = lairs.length;
        }

        if (room.controller) {
            if (room.controller.owner) {
                intel.owner = room.controller.owner.username;
                intel.hostile = !room.controller.my;
            } else if (room.controller.reservation) {
                intel.reservation = room.controller.reservation.username;
                intel.hostile = room.controller.reservation.username !== 'jules'; // placeholder for own username
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

        // Track important structures for routing or target logic
        const structures = room.find(FIND_STRUCTURES);
        intel.structureCount = structures.length;

    } else if (intel.type === 'highway') {
        const portals = room.find(FIND_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_PORTAL
        });
        intel.portals = portals.length > 0;

        // Can track power banks and deposits in the future
    }
}

function getScoutTarget(scoutCreep) {
    if (!Memory.intel) Memory.intel = {};

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

                        const intel = Memory.intel[neighborRoom];

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
