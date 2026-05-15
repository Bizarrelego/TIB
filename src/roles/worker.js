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

        for (const creep of workers) {
            try {
                if (creep.fatigue > 0) continue; // Fatigue gating

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

                const target = Game.getObjectById(targetId);
                if (!target) {
                    creep.heap.targetId = null;
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
