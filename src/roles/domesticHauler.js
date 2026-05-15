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

                let task = creep.heap.state || creep.heap.task;

                // If the logisticsManager assigned a state, use it as task priority
                if (creep.heap.state) {
                    task = creep.heap.state;
                } else {
                    // Fallback to legacy assignment
                    if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
                        task = 'pickup';
                        creep.heap.task = task;
                    } else if (creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
                        task = 'transfer';
                        creep.heap.task = task;
                    } else if (!task) {
                        task = 'pickup'; // Default
                        creep.heap.task = task;
                    }
                }

                if (task === 'transfer') {
                    let targetId = creep.heap.targetId;
                    let target = targetId ? Game.getObjectById(targetId) : null;

                    if (!target) {
                        // Fallback logic
                        const structures = global.State.structuresByRoom.get(room.name);

                    if (structures) {
                        // 1. Spawns / Extensions
                        const spawnsMap = structures.get(STRUCTURE_SPAWN);
                        if (spawnsMap) {
                            for (const spawn of spawnsMap.values()) {
                                if (spawn.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                                    target = spawn;
                                    break;
                                }
                            }
                        }

                        if (!target) {
                            const extensionsMap = structures.get(STRUCTURE_EXTENSION);
                            if (extensionsMap) {
                                for (const ext of extensionsMap.values()) {
                                    if (ext.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                                        target = ext;
                                        break;
                                    }
                                }
                            }
                        }

                        // 2. Towers
                        if (!target) {
                            const towersMap = structures.get(STRUCTURE_TOWER);
                            if (towersMap) {
                                for (const tower of towersMap.values()) {
                                    if (tower.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                                        target = tower;
                                        break;
                                    }
                                }
                            }
                        }

                        // 3. Storage
                        if (!target) {
                            const storageMap = structures.get(STRUCTURE_STORAGE);
                            if (storageMap) {
                                for (const storage of storageMap.values()) {
                                    if (storage.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                                        target = storage;
                                        break;
                                    }
                                }
                            }
                        }

                        // 4. Containers
                        if (!target) {
                            const containersMap = structures ? structures.get(STRUCTURE_CONTAINER) : null;
                            if (containersMap) {
                                for (const container of containersMap.values()) {
                                    if (container.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                                        target = container;
                                        break;
                                    }
                                }
                            }
                        }
                    }
                    }

                    if (targetId === 'controller') {
                        if (room.controller) {
                            if (creep.pos.inRangeTo(room.controller, 3)) {
                                creep.drop(RESOURCE_ENERGY);
                            } else {
                                movement.moveTo(creep, room.controller);
                            }
                        }
                    } else if (target) {
                        if (creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                            movement.moveTo(creep, target);
                        }
                    }
                } else {
                    let dropId = creep.heap.dropId;
                    let target = dropId ? Game.getObjectById(dropId) : null;

                    if (!target) {
                        // Fallback logic
                        // 1. Dropped Energy
                    const dropped = global.State.droppedByRoom.get(room.name);
                    if (dropped && dropped.length > 0) {
                        let minDistance = Infinity;
                        for (let i = 0; i < dropped.length; i++) {
                            const dist = creep.pos.getRangeTo(dropped[i]);
                            if (dist < minDistance && dropped[i].resourceType === RESOURCE_ENERGY) {
                                minDistance = dist;
                                target = dropped[i];
                            }
                        }
                    }

                    const structures = global.State.structuresByRoom.get(room.name);
                    if (structures) {
                        // 2. Containers
                        if (!target) {
                            const containersMap = structures.get(STRUCTURE_CONTAINER);
                            if (containersMap) {
                                let maxEnergy = 0;
                                for (const container of containersMap.values()) {
                                    const energy = container.store.getUsedCapacity(RESOURCE_ENERGY);
                                    if (energy > maxEnergy) {
                                        maxEnergy = energy;
                                        target = container;
                                    }
                                }
                                if (maxEnergy === 0) target = null;
                            }
                        }

                        // 3. Storage
                        if (!target) {
                            const storageMap = structures.get(STRUCTURE_STORAGE);
                            if (storageMap) {
                                for (const storage of storageMap.values()) {
                                    if (storage.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                                        target = storage;
                                        break;
                                    }
                                }
                            }
                        }

                        // 4. Source Links
                        if (!target) {
                            const linksMap = structures ? structures.get(STRUCTURE_LINK) : null;
                            if (linksMap) {
                                for (const link of linksMap.values()) {
                                    if (link.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                                        target = link;
                                        break;
                                    }
                                }
                            }
                        }
                    }
                    }

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
                }
            } catch (e) {
                console.log(`[domesticHauler Error] Room ${room.name}, Creep ${creep.name}: ${e.stack}`);
            }
        }
    }
};
