const TrafficManager = require('../traffic/trafficManager');
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
                            const status = TrafficManager.registerPickup(creep, target, RESOURCE_ENERGY, creep.store.getFreeCapacity());
                            if (status !== OK && creep.pos.getRangeTo(target) > 1) {
                                movement.moveTo(creep, target);
                            }
                        } else {
                            const status = TrafficManager.registerWithdraw(creep, target, RESOURCE_ENERGY, creep.store.getFreeCapacity());
                            if (status !== OK && creep.pos.getRangeTo(target) > 1) {
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

                        // Priority 1: Spawns and Extensions
                        const spawns = structures ? (structures.get(STRUCTURE_SPAWN) || []) : [];
                        const extensions = structures ? (structures.get(STRUCTURE_EXTENSION) || []) : [];
                        for (const s of spawns) {
                            if (s.store.getFreeCapacity(RESOURCE_ENERGY) > 0) { bestTarget = s; break; }
                        }
                        if (!bestTarget) {
                            for (const e of extensions) {
                                if (e.store.getFreeCapacity(RESOURCE_ENERGY) > 0) { bestTarget = e; break; }
                            }
                        }

                        // Priority 2: Storage (RCL 4)
                        const storage = room.storage;
                        if (!bestTarget && storage && storage.isActive() && storage.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                            bestTarget = storage;
                        }

                        // Priority 3: Upgrader Drop Pile
                        if (!bestTarget) {
                            const upgraders = global.State.creepsByRoom.get(room.name)?.get('upgrader') || [];
                            if (upgraders.length > 0 && !storage) {
                                creep.heap.targetId = 'controller';
                                target = null;
                                bestTarget = null;
                            }
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
                        const amount = Math.min(creep.store.getUsedCapacity(RESOURCE_ENERGY), TrafficManager.getVirtualState(target, RESOURCE_ENERGY).free);
                        if (amount > 0 && TrafficManager.registerTransfer(creep, target, RESOURCE_ENERGY, amount) === OK) {
                            TrafficManager.lockPipeline(creep.name, creep.id, target.id, RESOURCE_ENERGY, amount, 'TRANSFER');
                        } else if (creep.pos.getRangeTo(target) > 1) {
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
