/**
 * @file scout.js
 * @description Scout role that moves to a target room to gather intel.
 */
function run(room) {
    const scouts = global.State.creepsByRoom.get(room.name)?.get('scout') || [];

    for (const creep of scouts) {
        try {
            if (creep.fatigue > 0) continue;

            // Anti-Stall Failsafe: if standing on a STRUCTURE_SPAWN, move off it
            const structures = creep.pos.lookFor(LOOK_STRUCTURES);
            for (let i = 0; i < structures.length; i++) {
                if (structures[i].structureType === STRUCTURE_SPAWN) {
                    const randomDir = Math.floor(Math.random() * 8) + 1;
                    creep.move(randomDir);
                    break;
                }
            }

            const targetRoomName = creep.heap.targetRoom;

            // If no target room assigned by the scout manager, wait in place
            if (!targetRoomName) {
                // If standing on an exit tile, move into the room to prevent blocking and bouncing
                if (creep.pos.x === 0 || creep.pos.x === 49 || creep.pos.y === 0 || creep.pos.y === 49) {
                    const centerPos = new RoomPosition(25, 25, creep.room.name);
                    creep.moveTo(centerPos, { reusePath: 50 });
                }
                continue;
            }

            if (creep.room.name !== targetRoomName) {
                // Move towards the target room. Use a generic position in the middle.
                const targetPos = new RoomPosition(25, 25, targetRoomName);
                creep.moveTo(targetPos, { reusePath: 50 });
                continue;
            } else {
                // Once in the target room, move off the exit edge
                if (creep.pos.x === 0 || creep.pos.x === 49 || creep.pos.y === 0 || creep.pos.y === 49) {
                    const centerPos = new RoomPosition(25, 25, targetRoomName);
                    creep.moveTo(centerPos, { reusePath: 50 });
                } else {
                    // We are in the room and off the exit.
                    creep.heap.isStatic = true;
                    // Clear the target so the scout manager will assign a new one next tick.
                    creep.heap.targetRoom = null;
                }
            }

        } catch (e) {
            console.log(`[Scout Role Error] Room ${room.name}, Creep ${creep.name}: ${e.stack}`);
        }
    }
}

module.exports = { run };
