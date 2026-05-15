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

            const targetRoomName = creep.memory.targetRoom;
            if (!targetRoomName) continue;

            // If we are not in the target room, move towards it
            if (creep.room.name !== targetRoomName) {
                const targetPos = new RoomPosition(25, 25, targetRoomName);
                movement.moveTo(creep, targetPos);
                continue;
            }

            // We are in the target room. Bounce off the exit tile if needed.
            if (creep.pos.x === 0 || creep.pos.x === 49 || creep.pos.y === 0 || creep.pos.y === 49) {
                const centerPos = new RoomPosition(25, 25, targetRoomName);
                movement.moveTo(creep, centerPos);
                continue;
            }

            // Move to the room's controller
            const controller = creep.room.controller;
            if (!controller) continue; // If the room has no controller, we can't do anything

            // Check if claim part is on cooldown
            // Currently Screeps doesn't expose a 'claim cooldown' on the part itself,
            // but the room controller has `upgradeBlocked` if attacked. We just attempt the action.

            const isClaiming = creep.memory.claimFlag === true;

            // Check ownership / reservation status
            if (!controller.owner && (!controller.reservation || controller.reservation.username === creep.owner.username)) {
                // Unowned or reserved by us
                if (isClaiming) {
                    const result = creep.claimController(controller);
                    if (result === ERR_NOT_IN_RANGE) {
                        movement.moveTo(creep, controller);
                    } else if (result === ERR_GCL_NOT_ENOUGH) {
                        // Fall back to reserving
                        const reserveResult = creep.reserveController(controller);
                        if (reserveResult === ERR_NOT_IN_RANGE) {
                            movement.moveTo(creep, controller);
                        }
                    }
                } else {
                    const result = creep.reserveController(controller);
                    if (result === ERR_NOT_IN_RANGE) {
                        movement.moveTo(creep, controller);
                    } else if (result === ERR_INVALID_TARGET) {
                        // It might be already claimed, ignore or do something else
                    }
                }
            } else if (controller.owner || (controller.reservation && controller.reservation.username !== creep.owner.username)) {
                // Owned or reserved by someone else
                const result = creep.attackController(controller);
                if (result === ERR_NOT_IN_RANGE) {
                    movement.moveTo(creep, controller);
                }
            } else {
                // Already reserved by bot, just idle near it or renew if needed
                // Currently just parking near the controller
                if (!creep.pos.isNearTo(controller)) {
                    movement.moveTo(creep, controller);
                }
            }

        } catch (e) {
            console.log(`[reserver Error] Room ${room.name}, Creep ${creep.name}: ${e.stack}`);
        }
    }
}

module.exports = { run };
