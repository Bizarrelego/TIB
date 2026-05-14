/**
 * @file hauler.js
 * @description Hauler role. Sweeps dropped energy/ruins/tombstones and fills structures.
 * State and targets are managed by EconomyManager.
 */

const movement = require('../utils/movement');

module.exports = {
    /**
     * Executes logic for hauler role.
     * @param {Room} room
     */
    run: function(room) {
        const roomCreeps = global.State.creepsByRoom.get(room.name);
        if (!roomCreeps) return;

        const haulers = roomCreeps.get('hauler');
        if (!haulers || haulers.length === 0) return;

        for (const creep of haulers) {
            try {
                // Return immediately if fatigue > 0
                if (creep.fatigue > 0) continue;

                // State assigned centrally by EconomyManager
                if (creep.heap.state === 'pickup') {
                    let dropId = creep.heap.dropId;
                    let target = dropId ? Game.getObjectById(dropId) : null;

                    if (target) {
                        if (target.amount !== undefined) {
                            // Target is a dropped resource
                            if (creep.pickup(target) === ERR_NOT_IN_RANGE) {
                                movement.moveTo(creep, target);
                            }
                        } else {
                            // Target is a tombstone or ruin
                            if (creep.withdraw(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                                movement.moveTo(creep, target);
                            }
                        }
                    }
                } else if (creep.heap.state === 'transfer') {
                    let targetId = creep.heap.targetId;

                    if (targetId === 'controller') {
                        if (room.controller) {
                            if (creep.pos.inRangeTo(room.controller, 3)) {
                                creep.drop(RESOURCE_ENERGY);
                            } else {
                                movement.moveTo(creep, room.controller);
                            }
                        }
                    } else {
                        let target = targetId ? Game.getObjectById(targetId) : null;
                        if (target) {
                            const result = creep.transfer(target, RESOURCE_ENERGY);
                            if (result === ERR_NOT_IN_RANGE) {
                                movement.moveTo(creep, target);
                            }
                        }
                    }
                }
            } catch (e) {
                console.log(`[Hauler Error] Room ${room.name}, Creep ${creep.name}: ${e.stack}`);
            }
        }
    }
};
