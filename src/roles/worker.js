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
        const VirtualLedger = require('../utils/VirtualLedger');

        for (let i = 0; i < workers.length; i++) {
            const creep = workers[i];
            try {
                if (fatigueGating.isFatigued(creep) || TrafficManager.checkPipeline(creep.id)) continue;

                const state = creep.heap.state;
                const targetId = creep.heap.targetId;

                if (!state || !targetId) continue;

                const target = Game.getObjectById(targetId);
                if (!target) {
                    creep.heap.targetId = null;
                    creep.heap.state = null;
                    continue;
                }

                if (state === 'harvest') {
                    if (creep.pos.isNearTo(target)) {
                        const status = TrafficManager.registerHarvest(creep, target);
                        if (status === ERR_NOT_ENOUGH_RESOURCES) {
                            creep.heap.targetId = null;
                            creep.heap.state = null;
                        }
                    } else {
                        movement.moveTo(creep, target);
                    }
                } else if (state === 'pickup') {
                    if ((target.store && target.store[RESOURCE_ENERGY] === 0) || (target.amount !== undefined && target.amount === 0)) {
                        creep.heap.targetId = null;
                        creep.heap.state = null;
                        continue;
                    }
                    if (creep.pos.isNearTo(target)) {
                        let status;
                        const claimed = VirtualLedger.getClaimedAmount(target.id, RESOURCE_ENERGY);
                        const amountToWithdraw = target.amount !== undefined 
                            ? Math.min(creep.store.getFreeCapacity(RESOURCE_ENERGY), Math.max(0, target.amount - claimed))
                            : Math.min(creep.store.getFreeCapacity(RESOURCE_ENERGY), Math.max(0, TrafficManager.getVirtualState(target, RESOURCE_ENERGY).used - claimed));
                            
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
                        } else {
                            VirtualLedger.registerIntent(target.id, RESOURCE_ENERGY, amountToWithdraw);
                        }
                    } else {
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
                        const claimed = VirtualLedger.getClaimedAmount(target.id, RESOURCE_ENERGY);
                        const amountToWithdraw = target.store !== undefined
                            ? Math.min(creep.store.getFreeCapacity(RESOURCE_ENERGY), Math.max(0, TrafficManager.getVirtualState(target, RESOURCE_ENERGY).used - claimed))
                            : Math.min(creep.store.getFreeCapacity(RESOURCE_ENERGY), Math.max(0, target.amount - claimed));

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
                        } else {
                            VirtualLedger.registerIntent(target.id, RESOURCE_ENERGY, amountToWithdraw);
                        }
                    } else {
                        movement.moveTo(creep, target);
                    }
                } else if (state === 'fill') {
                    if (creep.pos.isNearTo(target)) {
                        const claimed = VirtualLedger.getClaimedAmount(target.id, RESOURCE_ENERGY);
                        const amountToFill = Math.min(creep.store.getUsedCapacity(RESOURCE_ENERGY), Math.max(0, TrafficManager.getVirtualState(target, RESOURCE_ENERGY).free - claimed));
                        
                        if (amountToFill > 0) {
                            TrafficManager.registerTransfer(creep, target, RESOURCE_ENERGY, amountToFill);
                            VirtualLedger.registerIntent(target.id, RESOURCE_ENERGY, amountToFill);
                        } else {
                            creep.heap.targetId = null;
                            creep.heap.state = null;
                        }
                    } else {
                        movement.moveTo(creep, target);
                    }
                } else if (state === 'build') {
                    if (creep.build(target) === ERR_NOT_IN_RANGE) {
                        movement.moveTo(creep, target);
                    }
                } else if (state === 'upgrade') {
                    if (creep.pos.getRangeTo(target) <= 3) {
                        creep.upgradeController(target);
                    } else {
                        movement.moveTo(creep, target);
                    }
                } else if (state === 'repair') {
                    if (creep.pos.getRangeTo(target) <= 3) {
                        creep.repair(target);
                    } else {
                        movement.moveTo(creep, target);
                    }
                }
            } catch (e) {
                console.log(`[worker Error] Room ${room.name}, Creep ${creep.name}: ${e.stack}`);
            }
        }
    }
};
