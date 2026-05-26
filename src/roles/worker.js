/**
 * @file worker.js
 * @description Multi-tool fallback (Harvest/Build/Upgrade) for early RCL. Blindly executes Top-Down Manager assignments.
 */

const movement = require('../utils/movement');
const TrafficManager = require('../traffic/trafficManager');
const fatigueGating = require('../utils/fatigueGating');

module.exports = {
    /**
     * Executes logic for worker role.
     * Targets and state are pre-assigned to creep.heap by colonyManager.
     * @param {Room} room
     */
    run(room) {
        const roomCreeps = global.State.creepsByRoom.get(room.name);
        if (!roomCreeps) return;

        const workers = roomCreeps.get('worker');
        if (!workers || workers.length === 0) return;

        for (let i = 0; i < workers.length; i++) {
            const creep = workers[i];
            try {
                if (creep.heap.isHarvesting && creep.store.getFreeCapacity() === 0) {
                    creep.heap.isHarvesting = false;
                    creep.heap.activeTask = null;
                    creep.heap.isStatic = false; // Un-anchor from the source
                }
                if (!creep.heap.isHarvesting && creep.store.getUsedCapacity() === 0) {
                    creep.heap.isHarvesting = true;
                    creep.heap.activeTask = null;
                    creep.heap.isStatic = false; // Un-anchor from the controller/hub
                }

                if (TrafficManager.checkPipeline(creep.id)) continue;
                const isFatigued = fatigueGating.isFatigued(creep);

                const state = creep.heap.state;
                const targetId = creep.heap.targetId;

                creep.heap.isStatic = false;

                if (!state || !targetId) continue;

                const target = Game.getObjectById(targetId);
                if (!target) {
                    creep.heap.targetId = null;
                    creep.heap.state = null;
                    continue;
                }

                if (state === 'harvest') {
                    if (creep.pos.isNearTo(target)) {
                        TrafficManager.setStatic(creep);
                        creep.heap.isStatic = true;
                        const status = TrafficManager.registerHarvest(creep, target);
                        if (status === ERR_NOT_ENOUGH_RESOURCES) {
                            creep.heap.targetId = null;
                            creep.heap.state = null;
                        }
                    } else if (!isFatigued) {
                        movement.moveTo(creep, target, { range: 1 });
                    }
                } else if (state === 'pickup') {
                    if ((target.store && target.store[RESOURCE_ENERGY] === 0) || (target.amount !== undefined && target.amount === 0)) {
                        creep.heap.targetId = null;
                        creep.heap.state = null;
                        continue;
                    }
                    if (creep.pos.isNearTo(target)) {
                        let status;
                        const amountToWithdraw = creep.heap.amount !== undefined ?
                            Math.min(creep.store.getFreeCapacity(RESOURCE_ENERGY), creep.heap.amount) :
                            creep.store.getFreeCapacity(RESOURCE_ENERGY);

                        if (amountToWithdraw <= 0) {
                            creep.heap.targetId = null;
                            creep.heap.state = null;
                            continue;
                        }

                        if (target.amount !== undefined) {
                            status = TrafficManager.registerPickup(creep, target, RESOURCE_ENERGY, amountToWithdraw);
                        } else if (target.store !== undefined) {
                            status = TrafficManager.registerWithdraw(creep, target, RESOURCE_ENERGY, amountToWithdraw);
                        }
                        if (status === ERR_NOT_ENOUGH_RESOURCES) {
                            creep.heap.targetId = null;
                            creep.heap.state = null;
                        }
                    } else if (!isFatigued) {
                        movement.moveTo(creep, target);
                    }
                } else if (state === 'withdraw') {
                    if ((target.store && target.store[RESOURCE_ENERGY] === 0) || (target.amount !== undefined && target.amount === 0)) {
                        creep.heap.targetId = null;
                        creep.heap.state = null;
                        continue;
                    }
                    if (creep.pos.isNearTo(target)) {
                        let status;
                        const amountToWithdraw = creep.heap.amount !== undefined ?
                            Math.min(creep.store.getFreeCapacity(RESOURCE_ENERGY), creep.heap.amount) :
                            creep.store.getFreeCapacity(RESOURCE_ENERGY);

                        if (amountToWithdraw <= 0) {
                            creep.heap.targetId = null;
                            creep.heap.state = null;
                            continue;
                        }

                        if (target.store !== undefined) {
                            status = TrafficManager.registerWithdraw(creep, target, RESOURCE_ENERGY, amountToWithdraw);
                        } else if (target.amount !== undefined) {
                            status = TrafficManager.registerPickup(creep, target, RESOURCE_ENERGY, amountToWithdraw);
                        }
                        if (status === ERR_NOT_ENOUGH_RESOURCES) {
                            creep.heap.targetId = null;
                            creep.heap.state = null;
                        }
                    } else if (!isFatigued) {
                        movement.moveTo(creep, target);
                    }
                } else if (state === 'fill' || state === 'refill') { // Fixes the string bug
                    if (creep.pos.isNearTo(target)) {
                        const amountToFill = creep.heap.amount !== undefined ?
                            Math.min(creep.store.getUsedCapacity(RESOURCE_ENERGY), creep.heap.amount) :
                            creep.store.getUsedCapacity(RESOURCE_ENERGY);

                        if (amountToFill > 0) {
                            TrafficManager.registerTransfer(creep, target, RESOURCE_ENERGY, amountToFill);
                        } else {
                            creep.heap.targetId = null;
                            creep.heap.state = null;
                        }
                    } else if (!isFatigued) {
                        movement.moveTo(creep, target);
                    }
                } else if (state === 'build') {
                    if (creep.pos.inRangeTo(target, 3)) {
                        TrafficManager.setStatic(creep);
                        TrafficManager.registerBuild(creep, target);
                    } else if (!isFatigued) {
                        movement.moveTo(creep, target, { range: 3 });
                    }
                } else if (state === 'upgrade') {
                    if (creep.pos.inRangeTo(target, 3)) {
                        TrafficManager.setStatic(creep);
                        TrafficManager.registerUpgrade(creep, target);
                    } else if (!isFatigued) {
                        movement.moveTo(creep, target, { range: 3 });
                    }
                } else if (state === 'repair') {
                    if (creep.pos.inRangeTo(target, 3)) {
                        TrafficManager.setStatic(creep);
                        TrafficManager.registerRepair(creep, target);
                    } else if (!isFatigued) {
                        movement.moveTo(creep, target, { range: 3 });
                    }
                }
            } catch (e) {
                console.log(`[worker Error] Room ${room.name}, Creep ${creep.name}: ${e.stack}`);
            }
        }
    }
};
