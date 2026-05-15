const movement = require('../utils/movement');

module.exports = {
    run: function(room) {
        const roomCreeps = global.State.creepsByRoom.get(room.name);
        if (!roomCreeps) return;

        const haulers = roomCreeps.get('hauler');
        if (!haulers) return;

        const fastFillers = roomCreeps.get('fastFiller') || [];
        const hasStorage = room.storage && room.storage.isActive();
        const ignoreCore = hasStorage && fastFillers.length > 0;

        for (const creep of haulers) {
            try {
                // Return immediately if fatigue > 0
                if (creep.fatigue > 0) continue;

                if (ignoreCore && creep.heap.state === 'transfer' && creep.heap.targetId) {
                    const target = Game.getObjectById(creep.heap.targetId);
                    if (target && (target.structureType === STRUCTURE_SPAWN || target.structureType === STRUCTURE_EXTENSION)) {
                        creep.heap.targetId = null; // Invalidate target
                    }
                }

                // State assigned centrally by logisticsManager
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
                            // Target is a structure, tombstone or ruin
                            if (creep.withdraw(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                                movement.moveTo(creep, target);
                            }
                        }
                    } else {
                        // Fallback: move to storage or center if no target
                        const storage = room.storage;
                        if (storage) {
                            movement.moveTo(creep, storage);
                        } else {
                            movement.moveTo(creep, new RoomPosition(25, 25, room.name));
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
                        } else {
                            // Fallback
                            const storage = room.storage;
                            if (storage && storage.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                                if (creep.transfer(storage, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                                    movement.moveTo(creep, storage);
                                }
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