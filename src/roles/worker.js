/**
 * @file worker.js
 * @description Multi-tool fallback (Harvest/Build/Upgrade). Replaced by dedicated roles.
 */

const movement = require('../utils/movement');
const TrafficManager = require('../traffic/trafficManager');

module.exports = {
    /**
     * Executes logic for worker role.
     * Targets and state are pre-assigned to creep.heap by workerManager.
     * @param {Room} room
     */
    run(room) {
        const roomCreeps = global.State.creepsByRoom.get(room.name);
        if (!roomCreeps) return;

        const workers = roomCreeps.get('worker');
        if (!workers || workers.length === 0) return;

        const storage = room.storage && room.storage.isActive() ? room.storage : null;


        // RCL 1 & 2 Blitz/Transition Mode
        if (room.controller && (room.controller.level === 1 || room.controller.level === 2)) {
            const sources = global.State.sourcesByRoom.get(room.name) || [];

            // Check for massive dropped energy piles (decaying)
            let massiveDrop = null;
            let dropped = [];
            if (global.State.droppedEnergyByRoom && global.State.droppedEnergyByRoom.has(room.name)) {
                dropped = global.State.droppedEnergyByRoom.get(room.name) || [];
            } else if (global.State.droppedByRoom && global.State.droppedByRoom.has(room.name)) {
                dropped = global.State.droppedByRoom.get(room.name) || [];
            }

            for (let i = 0; i < dropped.length; i++) {
                if (dropped[i].amount >= 300 && (!dropped[i].resourceType || dropped[i].resourceType === RESOURCE_ENERGY)) {
                    massiveDrop = dropped[i];
                    break;
                }
            }

            // Find nearest worker to the massive drop
            let nearestWorker = null;
            let minDropDist = Infinity;
            if (massiveDrop) {
                for (const creep of workers) {
                    if (creep.fatigue === 0 && creep.store.getFreeCapacity() > 0) {
                        const dist = creep.pos.getRangeTo(massiveDrop);
                        if (dist < minDropDist) {
                            minDropDist = dist;
                            nearestWorker = creep;
                        }
                    }
                }
            }

            for (const creep of workers) {
                try {
                    if (creep.fatigue > 0) continue; // Fatigue gating

                    if (nearestWorker && creep.name === nearestWorker.name) {
                        creep.heap.blitzTarget = massiveDrop.id;
                        if (creep.pos.isNearTo(massiveDrop)) {
                            TrafficManager.registerPickup(creep, massiveDrop, RESOURCE_ENERGY, Math.min(creep.store.getFreeCapacity(), massiveDrop.amount));
                        } else {
                            movement.moveTo(creep, massiveDrop);
                        }
                        creep.heap.blitzProcessed = true; // prevent RCL2 overwrite
                    } else if (creep.store.getUsedCapacity() === 0) {
                        // Find the source with the fewest creeps currently targeting it, respecting its walkable tiles
                        let bestSource = null;
                        let minRatio = Infinity;

                        for (const source of sources) {
                            let targeters = 0;
                            for (const other of workers) {
                                if (other.heap.blitzTarget === source.id) {
                                    targeters++;
                                }
                            }

                            let cap = 1;
                            if (global.State && global.State.sourceWalkableTiles) {
                                const roomTiles = global.State.sourceWalkableTiles.get(room.name);
                                if (roomTiles && roomTiles.has(source.id)) {
                                    cap = roomTiles.get(source.id);
                                }
                            }

                            if (targeters < cap) {
                                const ratio = targeters / cap;
                                if (ratio < minRatio) {
                                    minRatio = ratio;
                                    bestSource = source;
                                }
                            }
                        }

                        // If all sources are fully saturated, fallback to the one with fewest raw targeters
                        if (!bestSource && sources.length > 0) {
                             let minTargeters = Infinity;
                             for (const source of sources) {
                                 let targeters = 0;
                                 for (const other of workers) {
                                     if (other.heap.blitzTarget === source.id) {
                                         targeters++;
                                     }
                                 }
                                 if (targeters < minTargeters) {
                                     minTargeters = targeters;
                                     bestSource = source;
                                 }
                             }
                        }

                        if (bestSource) {
                            creep.heap.blitzTarget = bestSource.id;
                            if (creep.pos.isNearTo(bestSource)) {
                                TrafficManager.registerHarvest(creep, bestSource);
                            } else {
                                movement.moveTo(creep, bestSource);
                            }
                        }
                    } else if (creep.store.getFreeCapacity() === 0) {
                        creep.heap.blitzTarget = null;

                        const structures = global.State.structuresByRoom.get(room.name);
                        const spawns = structures ? (structures.get(STRUCTURE_SPAWN) || []) : [];
                        let targetSpawn = null;

                        let minDistance = Infinity;
                        for (const spawn of spawns) {
                            if (spawn.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                                const dist = creep.pos.getRangeTo(spawn);
                                if (dist < minDistance) {
                                    minDistance = dist;
                                    targetSpawn = spawn;
                                }
                            }
                        }

                        if (targetSpawn) {
                            if (targetSpawn.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
                                creep.heap.blitzTarget = null;
                                targetSpawn = null;
                                if (creep.pos.getRangeTo(room.controller) <= 3) {
                                    creep.upgradeController(room.controller);
                                } else {
                                    movement.moveTo(creep, room.controller);
                                }
                            } else if (creep.pos.isNearTo(targetSpawn)) {
                                TrafficManager.registerTransfer(creep, targetSpawn, RESOURCE_ENERGY, creep.store.getUsedCapacity(RESOURCE_ENERGY));
                            } else {
                                movement.moveTo(creep, targetSpawn);
                            }
                        } else if (room.controller) {
                            if (creep.pos.getRangeTo(room.controller) <= 3) {
                                creep.upgradeController(room.controller);
                            } else {
                                movement.moveTo(creep, room.controller);
                            }
                        }
                    } else {
                        // If partially full/empty, continue previous action based on blitzTarget presence
                        if (creep.heap.blitzTarget) {
                             const target = Game.getObjectById(creep.heap.blitzTarget);
                             if (target) {
                                 if (creep.pos.isNearTo(target)) {
                                     TrafficManager.registerHarvest(creep, target);
                                 } else {
                                     movement.moveTo(creep, target);
                                 }
                             } else {
                                 creep.heap.blitzTarget = null;
                             }
                        } else {
                            // If no blitzTarget and not empty, act as if full (transfer/upgrade)
                            const structures = global.State.structuresByRoom.get(room.name);
                            const spawns = structures ? (structures.get(STRUCTURE_SPAWN) || []) : [];
                            let targetSpawn = null;

                            let minDistance = Infinity;
                            for (const spawn of spawns) {
                                if (spawn.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                                    const dist = creep.pos.getRangeTo(spawn);
                                    if (dist < minDistance) {
                                        minDistance = dist;
                                        targetSpawn = spawn;
                                    }
                                }
                            }

                            if (targetSpawn) {
                                if (targetSpawn.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
                                    creep.heap.blitzTarget = null;
                                    targetSpawn = null;
                                    if (creep.pos.getRangeTo(room.controller) <= 3) {
                                        creep.upgradeController(room.controller);
                                    } else {
                                        movement.moveTo(creep, room.controller);
                                    }
                                } else if (creep.pos.isNearTo(targetSpawn)) {
                                    TrafficManager.registerTransfer(creep, targetSpawn, RESOURCE_ENERGY, creep.store.getUsedCapacity(RESOURCE_ENERGY));
                                } else {
                                    movement.moveTo(creep, targetSpawn);
                                }
                            } else if (room.controller) {
                                if (creep.pos.getRangeTo(room.controller) <= 3) {
                                    creep.upgradeController(room.controller);
                                } else {
                                    movement.moveTo(creep, room.controller);
                                }
                            }
                        }
                    }
                } catch (e) {
                    console.log(`[worker Error] Room ${room.name}, Creep ${creep.name}: ${e.stack}`);
                }
            }
            if (room.controller.level === 1) {
                return; // Skip standard RCL > 1 logic for RCL 1 entirely
            }
        }

        // RCL > 1 Standard Logic (RCL 2 runs both blitz decay recovery and this if no decay)
        for (const creep of workers) {
            try {
                if (creep.fatigue > 0) continue; // Fatigue gating
                if (creep.heap.blitzProcessed) {
                    creep.heap.blitzProcessed = false; // Reset for next tick
                    continue; // Skip standard logic if we already processed blitz action this tick
                }

                const state = creep.heap.state;
                let targetId = creep.heap.targetId;

                if (state === 'pickup') {
                    let target = null;
                    if (storage && storage.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                        target = storage;
                    } else if (targetId) {
                        target = Game.getObjectById(targetId);
                    }

                    if (!target || (target.store && target.store.getUsedCapacity(RESOURCE_ENERGY) === 0) || (target.amount !== undefined && target.amount === 0)) {
                         const EnergyRequestManager = require('../managers/EnergyRequestManager');
                         const supplies = EnergyRequestManager.getEnergySupplies(room.name, 'worker');
                         if (supplies.length > 0) {
                             target = supplies[0].target;
                         }
                    }

                    if (target) {
                        if (!creep.pos.isNearTo(target)) {
                            movement.moveTo(creep, target);
                        } else {
                            const amountToTake = Math.min(creep.store.getFreeCapacity(RESOURCE_ENERGY), target.amount || (target.store ? target.store.getUsedCapacity(RESOURCE_ENERGY) : 0));
                            if (amountToTake > 0) {
                                if (target instanceof Resource) {
                                    TrafficManager.registerPickup(creep, target, RESOURCE_ENERGY, amountToTake);
                                } else {
                                    TrafficManager.registerWithdraw(creep, target, RESOURCE_ENERGY, amountToTake);
                                }
                            }
                        }
                    }
                    continue;
                }

                if (!state || !targetId) continue;

                let target = Game.getObjectById(targetId);
                if (target && target.store && target.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
                    creep.heap.targetId = null;
                    target = null;
                }
                if (!target) {
                    creep.heap.targetId = null;
                    if (creep.store && creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0 && room.controller) {
                        if (creep.upgradeController(room.controller) === ERR_NOT_IN_RANGE) {
                            movement.moveTo(creep, room.controller);
                        }
                    }
                    continue;
                }

                if (state === 'harvest') {
                    if (!creep.pos.isNearTo(target)) {
                        movement.moveTo(creep, target);
                    } else {
                        TrafficManager.registerHarvest(creep, target);
                    }
                } else if (state === 'repair') {
                    if (creep.repair(target) === ERR_NOT_IN_RANGE) {
                        movement.moveTo(creep, target);
                    }
                } else if (state === 'refill') {
                    if (!creep.pos.isNearTo(target)) {
                        movement.moveTo(creep, target);
                    } else {
                        const amountToGive = Math.min(creep.store.getUsedCapacity(RESOURCE_ENERGY), TrafficManager.getVirtualState(target, RESOURCE_ENERGY).free);
                        if (amountToGive > 0) {
                            TrafficManager.registerTransfer(creep, target, RESOURCE_ENERGY, amountToGive);
                        }
                    }
                } else if (state === 'build') {
                    if (creep.build(target) === ERR_NOT_IN_RANGE) {
                        movement.moveTo(creep, target);
                    }
                } else if (state === 'upgrade') {
                    if (creep.upgradeController(target) === ERR_NOT_IN_RANGE) {
                        movement.moveTo(creep, target);
                    }
                }

            } catch (e) {
                console.log(`[worker Error] Room ${room.name}, Creep ${creep.name}: ${e.stack}`);
            }
        }

    }
};
