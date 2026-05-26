const TrafficManager = require('../traffic/trafficManager');
const movement = require('../utils/movement');

/**
 * @file scout.js
 * @description Scout role that moves to a target room to gather intel.
 */
function run(room) {
    const scouts = global.State.creepsByRoom.get(room.name)?.get('scout') || [];

    for (const creep of scouts) {
        try {
            if (creep.fatigue > 0) continue;

            const targetRoomName = creep.heap.targetRoom;

            // If no target room assigned by the scout manager, wait in place
            if (!targetRoomName) {
                // If standing on an exit tile, move into the room to prevent blocking and bouncing
                if (creep.pos.x === 0 || creep.pos.x === 49 || creep.pos.y === 0 || creep.pos.y === 49) {
                    const centerPos = new RoomPosition(25, 25, creep.room.name);
                    movement.moveTo(creep, centerPos);
                }
                continue;
            }

            if (creep.room.name !== targetRoomName) {
                // Move towards the target room. Use a generic position in the middle.
                const targetPos = new RoomPosition(25, 25, targetRoomName);

                // Pass custom opts to avoid highly hostile rooms if known
                const opts = {
                    roomCallback: function(roomName) {
                        const intel = global.State && global.State.intel ? global.State.intel.get(roomName) : null;
                        if (intel && intel.hostile) {
                            return false; // PathFinder won't route through this room
                        }
                        return undefined;
                    }
                };

                movement.moveTo(creep, targetPos, opts);
                continue;
            } else {
                // Once in the target room, move off the exit edge
                if (creep.pos.x === 0 || creep.pos.x === 49 || creep.pos.y === 0 || creep.pos.y === 49) {
                    const centerPos = new RoomPosition(25, 25, targetRoomName);
                    movement.moveTo(creep, centerPos);
                } else {
                    // We are in the room and off the exit.
                    TrafficManager.setStatic(creep);
                    creep.heap.isStatic = true;
                }
            }

        } catch (e) {
            console.log(`[Scout Role Error] Room ${room.name}, Creep ${creep.name}: ${e.stack}`);
        }
    }
}

module.exports = { run };
