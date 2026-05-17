/**
 * @file worker.js
 * @description Multi-tool fallback (Harvest/Build/Upgrade) for early RCL. Blindly executes Top-Down Manager assignments.
 */

const movement = require('../utils/movement');
const TrafficManager = require('../traffic/trafficManager');

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
                if (creep.fatigue > 0 || TrafficManager.checkPipeline(creep.id)) continue;

                const state = creep.heap.state;
                const targetId = creep.heap.targetId;

                if (!state || !targetId) continue;

                const target = Game.getObjectById(targetId);
                if (target === null || target === undefined) {
                    creep.heap.state = null;
                    creep.heap.targetId = null;
                    continue; // Skip further processing for this creep; delegates reassignment to the manager next tick
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
                    if (creep.pos.isNearTo(target)) {
                        const status = TrafficManager.registerPickup(creep, target, RESOURCE_ENERGY, Math.min(creep.store.getFreeCapacity(RESOURCE_ENERGY), target.amount));
                        if (status === ERR_NOT_ENOUGH_RESOURCES) {
                            creep.heap.targetId = null;
                            creep.heap.state = null;
                        }
                    } else {
                        movement.moveTo(creep, target);
                    }
                } else if (state === 'withdraw') {
                    if (creep.pos.isNearTo(target)) {
                        const status = TrafficManager.registerWithdraw(creep, target, RESOURCE_ENERGY, Math.min(creep.store.getFreeCapacity(RESOURCE_ENERGY), TrafficManager.getVirtualState(target, RESOURCE_ENERGY).used));
                        if (status === ERR_NOT_ENOUGH_RESOURCES) {
                            creep.heap.targetId = null;
                            creep.heap.state = null;
                        }
                    } else {
                        movement.moveTo(creep, target);
                    }
                } else if (state === 'refill') {
                    if (creep.pos.isNearTo(target)) {
                        TrafficManager.registerTransfer(creep, target, RESOURCE_ENERGY, Math.min(creep.store.getUsedCapacity(RESOURCE_ENERGY), TrafficManager.getVirtualState(target, RESOURCE_ENERGY).free));
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
