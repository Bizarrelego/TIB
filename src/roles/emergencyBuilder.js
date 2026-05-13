/**
 * @file emergencyBuilder.js
 * @description Ignores all standard logic. Mines nearest node, directly refills spawn.
 */

const movement = require('../utils/movement');

module.exports = {
    /**
     * Executes logic for emergencyBuilder role.
     * @param {Room} room
     */
    run(room) {
        const roomCreeps = global.State.creepsByRoom.get(room.name);
        if (!roomCreeps) return;

        const emergencyBuilders = roomCreeps.get('emergencyBuilder');
        if (!emergencyBuilders || emergencyBuilders.length === 0) return;

        for (const creep of emergencyBuilders) {
            try {
                if (creep.fatigue > 0) continue; // Fatigue gating

                creep.heap = creep.heap || {};

                if (creep.heap.state !== 'harvesting' && creep.store.getUsedCapacity() === 0) {
                    creep.heap.state = 'harvesting';
                    creep.heap.targetId = null;
                }
                if (creep.heap.state === 'harvesting' && creep.store.getFreeCapacity() === 0) {
                    creep.heap.state = 'filling';
                    creep.heap.targetId = null;
                }

                if (creep.heap.state === 'harvesting') {
                    let target = null;
                    if (creep.heap.targetId) {
                        target = Game.getObjectById(creep.heap.targetId);
                    }
                    if (!target) {
                        target = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
                        if (target) creep.heap.targetId = target.id;
                    }

                    if (target) {
                        if (creep.pos.isNearTo(target)) {
                            creep.harvest(target);
                        } else {
                            movement.moveTo(creep, target);
                        }
                    }
                } else {
                    let target = null;
                    if (creep.heap.targetId) {
                        target = Game.getObjectById(creep.heap.targetId);
                    }
                    if (!target || target.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
                        const spawns = global.State.structuresByRoom.get(room.name)?.get(STRUCTURE_SPAWN) || [];
                        const extensions = global.State.structuresByRoom.get(room.name)?.get(STRUCTURE_EXTENSION) || [];

                        let needsRefill = [];
                        for (let i = 0; i < spawns.length; i++) {
                            if (spawns[i].store.getFreeCapacity(RESOURCE_ENERGY) > 0) needsRefill.push(spawns[i]);
                        }
                        for (let i = 0; i < extensions.length; i++) {
                            if (extensions[i].store.getFreeCapacity(RESOURCE_ENERGY) > 0) needsRefill.push(extensions[i]);
                        }

                        if (needsRefill.length > 0) {
                            target = creep.pos.findClosestByPath(needsRefill);
                            if (target) creep.heap.targetId = target.id;
                        }
                    }

                    if (target) {
                        if (creep.pos.isNearTo(target)) {
                            creep.transfer(target, RESOURCE_ENERGY);
                        } else {
                            movement.moveTo(creep, target);
                        }
                    } else {
                        // Upgrade if everything is full but emergency builder still alive
                        if (room.controller) {
                            if (creep.pos.inRangeTo(room.controller, 3)) {
                                creep.upgradeController(room.controller);
                            } else {
                                movement.moveTo(creep, room.controller);
                            }
                        }
                    }
                }
            } catch (e) {
                console.error(`[emergencyBuilder Error] Room ${room.name}, Creep ${creep.name}: ${e.stack}`);
            }
        }
    }
};
