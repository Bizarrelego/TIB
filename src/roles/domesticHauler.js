/**
 * @file domesticHauler.js
 * @description Local source to Spawn/Ext transport. Retires when source Links deploy.
 */

const movement = require('../utils/movement');

module.exports = {
    /**
     * Executes logic for domesticHauler role.
     * @param {Room} room
     */
    run(room) {
        const roomCreeps = global.State.creepsByRoom.get(room.name);
        if (!roomCreeps) return;

        const domesticHaulers = roomCreeps.get('domesticHauler');
        if (!domesticHaulers || domesticHaulers.length === 0) return;

        for (const creep of domesticHaulers) {
            try {
                if (creep.fatigue > 0) continue; // Fatigue gating

                creep.heap = creep.heap || {};

                if (creep.heap.state !== 'withdrawing' && creep.store.getUsedCapacity() === 0) {
                    creep.heap.state = 'withdrawing';
                    creep.heap.targetId = null;
                }
                if (creep.heap.state === 'withdrawing' && creep.store.getFreeCapacity() === 0) {
                    creep.heap.state = 'transferring';
                    creep.heap.targetId = null;
                }

                if (creep.heap.state === 'withdrawing') {
                    let target = null;
                    if (creep.heap.targetId) {
                        target = Game.getObjectById(creep.heap.targetId);
                    }
                    if (!target) {
                        const dropped = global.State.droppedByRoom.get(room.name);
                        if (dropped && dropped.length > 0) {
                            target = dropped[0];
                        } else {
                            // Find tombstone/ruin with energy
                            const tombstones = global.State.tombstonesByRoom.get(room.name);
                            if (tombstones && tombstones.length > 0 && tombstones[0].store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                                target = tombstones[0];
                            }
                        }
                        if (target) creep.heap.targetId = target.id;
                    }

                    if (target) {
                        if (creep.pos.isNearTo(target)) {
                            if (target instanceof Resource) {
                                creep.pickup(target);
                            } else {
                                creep.withdraw(target, RESOURCE_ENERGY);
                            }
                        } else {
                            movement.moveTo(creep, target);
                        }
                    } else {
                        // Wait near a source
                        const source = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
                        if (source && !creep.pos.inRangeTo(source, 3)) {
                            movement.moveTo(creep, source);
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
                        } else {
                            const storages = global.State.structuresByRoom.get(room.name)?.get(STRUCTURE_STORAGE) || [];
                            if (storages.length > 0) target = storages[0];
                        }

                        if (target) creep.heap.targetId = target.id;
                    }

                    if (target) {
                        if (creep.pos.isNearTo(target)) {
                            creep.transfer(target, RESOURCE_ENERGY);
                        } else {
                            movement.moveTo(creep, target);
                        }
                    }
                }
            } catch (e) {
                console.error(`[domesticHauler Error] Room ${room.name}, Creep ${creep.name}: ${e.stack}`);
            }
        }
    }
};
