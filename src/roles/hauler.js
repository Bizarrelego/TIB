const movement = require('../utils/movement');

module.exports = {
    run: function(room) {
        const roomCreeps = global.State.creepsByRoom.get(room.name);
        if (!roomCreeps) return;

        const haulers = roomCreeps.get('hauler');
        if (!haulers) return;

        const fastFillers = roomCreeps.get('fastFiller') || [];
        const ignoreCore = fastFillers.length > 0;

        for (const creep of haulers) {
            try {
                if (creep.fatigue > 0) continue;

                if (ignoreCore && creep.heap.state === 'transfer' && creep.heap.targetId) {
                    const target = Game.getObjectById(creep.heap.targetId);
                    if (target && (target.structureType === STRUCTURE_SPAWN || target.structureType === STRUCTURE_EXTENSION)) {
                        creep.heap.targetId = null; // Invalidate target
                    }
                }

                if (creep.heap.state === 'pickup') {
                    let dropId = creep.heap.dropId;
                    let target = dropId ? Game.getObjectById(dropId) : null;

                    if (target) {
                        if ((target.amount !== undefined && target.amount === 0) || (target.store && target.store.getUsedCapacity(RESOURCE_ENERGY) === 0)) {
                            creep.heap.dropId = null;
                            target = null;
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
                    let target = targetId ? Game.getObjectById(targetId) : null;

                    // If we have a fast filler, prioritize drops specifically to bridge containers and core
                    if (ignoreCore) {
                        // Priority 1: Anchor/Core Container (if Storage is missing)
                        // Priority 2: Controller Container
                        // Priority 3: TOWER (under 70% capacity)
                        let bestTarget = null;
                        const structures = global.State.structuresByRoom.get(room.name);
                        const containers = structures ? (structures.get(STRUCTURE_CONTAINER) || []) : [];
                        const storage = room.storage && room.storage.isActive() ? room.storage : null;

                        // Pre-calculated references should be fetched from global state or managed more efficiently if needed.
                        // However, we still need to resolve these targets without looping over all structures every tick.
                        // We will use cached target IDs in memory/heap where possible.

                        let coreContainer = creep.heap.coreContainerId ? Game.getObjectById(creep.heap.coreContainerId) : null;
                        if (!storage && !coreContainer) {
                            const plannerState = global.State.roomPlanner ? global.State.roomPlanner.get(room.name) : null;
                            if (plannerState && plannerState.has('anchor')) {
                                const anchor = plannerState.get('anchor');
                                if (anchor) {
                                    for (const container of containers) {
                                        if (container.pos.x === anchor.x && container.pos.y === anchor.y && container.isActive()) {
                                            coreContainer = container;
                                            creep.heap.coreContainerId = container.id;
                                            break;
                                        }
                                    }
                                }
                            }
                        }

                        let controllerContainer = creep.heap.controllerContainerId ? Game.getObjectById(creep.heap.controllerContainerId) : null;
                        if (room.controller && !controllerContainer) {
                            for (const container of containers) {
                                if (container.pos.inRangeTo(room.controller, 3)) {
                                    controllerContainer = container;
                                    creep.heap.controllerContainerId = container.id;
                                    break;
                                }
                            }
                        }

                        // Get tower target from TowerManager if possible, or just evaluate known towers if cached.
                        // For zero polling, we shouldn't iterate all towers every tick per creep.
                        // Instead, we will only evaluate tower needs if specifically requested or via a central manager.
                        // For now, simplify or remove the per-creep iteration.
                        // We can use a cached tower target ID from room.memory or global state if available, but let's avoid looping here.
                        let towerTarget = null;
                        if (global.State.towerNeeds && global.State.towerNeeds.has(room.name)) {
                            const needs = global.State.towerNeeds.get(room.name);
                            if (needs.length > 0) {
                                towerTarget = needs[0]; // just grab the first one flagged by manager
                            }
                        }

                        if (!storage && coreContainer && coreContainer.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                            bestTarget = coreContainer;
                        } else if (storage && storage.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                            bestTarget = storage;
                        } else if (controllerContainer && controllerContainer.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                            bestTarget = controllerContainer;
                        } else if (towerTarget) {
                            bestTarget = towerTarget;
                        } else if (target && target.store && target.store.getFreeCapacity(RESOURCE_ENERGY) > 0 && target.structureType !== STRUCTURE_SPAWN && target.structureType !== STRUCTURE_EXTENSION) {
                            bestTarget = target;
                        }

                        target = bestTarget;
                        if (target) {
                            creep.heap.targetId = target.id;
                        } else {
                            creep.heap.targetId = null;
                        }
                    }

                    if (target) {
                        if (target.store && target.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
                            creep.heap.targetId = null;
                            target = null;
                        }
                    }

                    if (target) {
                        const result = creep.transfer(target, RESOURCE_ENERGY);
                        if (result === ERR_NOT_IN_RANGE) {
                            movement.moveTo(creep, target);
                        }
                    } else if (targetId === 'controller' && room.controller) {
                        if (creep.pos.inRangeTo(room.controller, 3)) {
                            creep.drop(RESOURCE_ENERGY);
                        } else {
                            movement.moveTo(creep, room.controller);
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
            } catch (e) {
                console.log(`[Hauler Error] Room ${room.name}, Creep ${creep.name}: ${e.stack}`);
            }
        }
    }
};
