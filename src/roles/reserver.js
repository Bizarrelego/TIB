/**
 * @file reserver.js
 * @description Reserves or claims a controller in a remote room.
 */

const movement = require('../utils/movement');

/**
 * Executes logic for reserver role.
 * @param {Room} room The home room of the colony managing these creeps.
 */
function run(room) {
    const roomCreeps = global.State.creepsByRoom.get(room.name);
    if (!roomCreeps) return;

    const reservers = roomCreeps.get('reserver');
    if (!reservers || reservers.length === 0) return;

    for (const creep of reservers) {
        try {
            if (creep.fatigue > 0) continue; // Fatigue gating

            const targetRoomName = creep.memory.targetRoom || creep.heap.targetRoom;

            // If we are not in the target room, move towards it
            if (targetRoomName && creep.room.name !== targetRoomName) {
                const targetPos = new RoomPosition(25, 25, targetRoomName);
                movement.moveTo(creep, targetPos);
                continue;
            }

            const targetId = creep.heap.targetId;
            if (!targetId) continue;

            const controller = Game.getObjectById(targetId);
            if (!controller) continue; // If the room has no controller, we can't do anything

            const isClaiming = creep.memory.claimFlag || creep.heap.claimFlag;

            if (isClaiming) {
                const result = creep.claimController(controller);
                if (result === ERR_NOT_IN_RANGE) {
                    movement.moveTo(creep, controller);
                } else if (result === ERR_GCL_NOT_ENOUGH) {
                    // Fall back to reserving
                    if (creep.reserveController(controller) === ERR_NOT_IN_RANGE) {
                        movement.moveTo(creep, controller);
                    }
                }
            } else if (creep.heap.state === 'attackController') {
                if (creep.attackController(controller) === ERR_NOT_IN_RANGE) {
                    movement.moveTo(creep, controller);
                }
            } else {
                if (creep.reserveController(controller) === ERR_NOT_IN_RANGE) {
                    movement.moveTo(creep, controller);
                }
            }

        } catch (e) {
            console.log(`[reserver Error] Room ${room.name}, Creep ${creep.name}: ${e.stack}`);
        }
    }
}

module.exports = { run };
