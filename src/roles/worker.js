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
                // State resets are now handled directly by the manager

                if (TrafficManager.checkPipeline(creep.id)) continue;
                if (fatigueGating.isFatigued(creep)) continue;

                const state = creep.heap.subState || creep.heap.state;
                const targetId = creep.heap.targetId;

                creep.heap.isStatic = false;

                if (!state || !targetId) continue;

                const target = Game.getObjectById(targetId);
                if (!target) {
                    creep.heap.targetId = null;
                    creep.heap.subState = null;
                    // Do not clear creep.heap.state, so the manager can re-evaluate the target
                    continue;
                }

                if (state === 'pickup') {
                    if (creep.pos.isNearTo(target)) {
                        let amount = creep.heap.amount;
                        if (amount === undefined) amount = creep.store.getFreeCapacity(RESOURCE_ENERGY);
                        TrafficManager.registerPickup(creep, target, RESOURCE_ENERGY, amount);
                    } else movement.moveTo(creep, target);
                } else if (state === 'harvest') {
                    if (creep.pos.isNearTo(target)) {
                        TrafficManager.setStatic(creep);
                        creep.heap.isStatic = true;
                        TrafficManager.registerHarvest(creep, target);
                    } else movement.moveTo(creep, target, { range: 1 });
                } else if (state === 'build') {
                    if (creep.pos.inRangeTo(target, 3)) {
                        TrafficManager.setStatic(creep);
                        TrafficManager.registerBuild(creep, target);
                    } else movement.moveTo(creep, target, { range: 3 });
                } else if (state === 'upgrade') {
                    if (creep.pos.inRangeTo(target, 3)) {
                        TrafficManager.setStatic(creep);
                        TrafficManager.registerUpgrade(creep, target);
                    } else movement.moveTo(creep, target, { range: 3 });
                } else if (state === 'fill' || state === 'refill') {
                    if (creep.pos.isNearTo(target)) {
                        let amount = creep.heap.amount;
                        if (amount === undefined) amount = creep.store.getUsedCapacity(RESOURCE_ENERGY);
                        TrafficManager.registerTransfer(creep, target, RESOURCE_ENERGY, amount);
                    } else movement.moveTo(creep, target, { range: 1 });
                } else if (state === 'withdraw') {
                    if (creep.pos.isNearTo(target)) {
                        let amount = creep.heap.amount;
                        if (amount === undefined) amount = creep.store.getFreeCapacity(RESOURCE_ENERGY);
                        TrafficManager.registerWithdraw(creep, target, RESOURCE_ENERGY, amount);
                    } else movement.moveTo(creep, target, { range: 1 });
                } else if (state === 'repair') {
                    if (creep.pos.inRangeTo(target, 3)) {
                        TrafficManager.setStatic(creep);
                        TrafficManager.registerRepair(creep, target);
                    } else movement.moveTo(creep, target, { range: 3 });
                }
            } catch (e) {
                console.log(`[worker Error] Room ${room.name}, Creep ${creep.name}: ${e.stack}`);
            }
        }
    }
};
