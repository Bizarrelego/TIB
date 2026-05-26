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
                    if (creep.pickup(target) === ERR_NOT_IN_RANGE) movement.moveTo(creep, target);
                } else if (state === 'harvest') {
                    if (creep.harvest(target) === ERR_NOT_IN_RANGE) movement.moveTo(creep, target, { range: 1 });
                } else if (state === 'build') {
                    if (creep.build(target) === ERR_NOT_IN_RANGE) movement.moveTo(creep, target, { range: 3 });
                } else if (state === 'upgrade') {
                    if (creep.upgradeController(target) === ERR_NOT_IN_RANGE) movement.moveTo(creep, target, { range: 3 });
                } else if (state === 'fill' || state === 'refill') {
                    const amount = creep.heap.amount !== undefined ? Math.min(creep.store.getUsedCapacity(RESOURCE_ENERGY), creep.heap.amount) : undefined;
                    if (creep.transfer(target, RESOURCE_ENERGY, amount) === ERR_NOT_IN_RANGE) movement.moveTo(creep, target, { range: 1 });
                } else if (state === 'withdraw') {
                    const amount = creep.heap.amount !== undefined ? Math.min(creep.store.getFreeCapacity(RESOURCE_ENERGY), creep.heap.amount) : undefined;
                    if (creep.withdraw(target, RESOURCE_ENERGY, amount) === ERR_NOT_IN_RANGE) movement.moveTo(creep, target, { range: 1 });
                } else if (state === 'repair') {
                    if (creep.repair(target) === ERR_NOT_IN_RANGE) movement.moveTo(creep, target, { range: 3 });
                }
            } catch (e) {
                console.log(`[worker Error] Room ${room.name}, Creep ${creep.name}: ${e.stack}`);
            }
        }
    }
};
