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

                // Retirement Logic
                if (creep.heap && creep.heap.retired) {
                    const homeRoomName = creep.memory.homeRoom || room.name;
                    const structures = global.State.structuresByRoom.get(homeRoomName);
                    if (structures) {
                        const spawnsMap = structures.get(STRUCTURE_SPAWN);
                        if (spawnsMap && spawnsMap.size > 0) {
                            const spawns = Array.from(spawnsMap.values());
                            let nearestSpawn = null;
                            let minDistance = Infinity;
                            for (let i = 0; i < spawns.length; i++) {
                                const spawn = spawns[i];
                                const dist = creep.pos.getRangeTo(spawn);
                                if (dist < minDistance) {
                                    minDistance = dist;
                                    nearestSpawn = spawn;
                                }
                            }
                            if (nearestSpawn) {
                                if (creep.pos.isNearTo(nearestSpawn)) {
                                    nearestSpawn.recycleCreep(creep);
                                } else {
                                    movement.moveTo(creep, nearestSpawn);
                                }
                                continue;
                            }
                        }
                    }
                    // Fallback to move to room center if no spawn found or if just retired but room lacks structures map yet
                    const center = new RoomPosition(25, 25, homeRoomName);
                    movement.moveTo(creep, center);
                    continue;
                }

                const state = creep.heap.state;
                const targetId = creep.heap.targetId;

                if (!state || !targetId) continue;

                const target = Game.getObjectById(creep.heap.targetId);
                if (!target && creep.heap.targetId !== 'controller') { creep.heap.targetId = null; creep.heap.state = null; continue; }

                if (creep.heap.state === 'pickup' || creep.heap.state === 'withdraw') {
                    if (target) {
                        if (target.amount !== undefined) {
                            if (creep.pickup(target) === ERR_NOT_IN_RANGE) {
                                movement.moveTo(creep, target);
                            }
                        } else {
                            if (creep.withdraw(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                                movement.moveTo(creep, target);
                            }
                        }
                    }
                } else if (creep.heap.state === 'transfer') {
                    if (target) {
                        if (creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                            movement.moveTo(creep, target);
                        }
                    } else if (creep.heap.targetId === 'controller' && room.controller) {
                        if (creep.pos.inRangeTo(room.controller, 3)) {
                            creep.drop(RESOURCE_ENERGY);
                        } else {
                            movement.moveTo(creep, room.controller);
                        }
                    }
                }
            } catch (e) {
                console.log(`[domesticHauler Error] Room ${room.name}, Creep ${creep.name}: ${e.stack}`);
            }
        }
    }
};
