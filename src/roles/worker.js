/**
 * @file worker.js
 * @description Multi-tool fallback (Harvest/Build/Upgrade) for early RCL. Blindly executes Top-Down Manager assignments.
 */

const movement = require('../utils/movement');
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
                }
                if (!creep.heap.isHarvesting && creep.store.getUsedCapacity() === 0) {
                    creep.heap.isHarvesting = true;
                    creep.heap.activeTask = null;
                }

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
                        creep.harvest(target);
                    } else if (!fatigueGating.isFatigued(creep)) {
                        movement.moveTo(creep, target, { range: 1 });
                    }
                } else if (state === 'pickup') {
                    if ((target.store && target.store[RESOURCE_ENERGY] === 0) || (target.amount !== undefined && target.amount === 0)) {
                        creep.heap.targetId = null;
                        creep.heap.state = null;
                        continue;
                    }
                    if (creep.pos.isNearTo(target)) {
                        if (target.amount !== undefined) {
                            creep.pickup(target);
                        } else if (target.store !== undefined) {
                            creep.withdraw(target, RESOURCE_ENERGY);
                        }
                    } else if (!fatigueGating.isFatigued(creep)) {
                        movement.moveTo(creep, target);
                    }
                } else if (state === 'withdraw') {
                    if ((target.store && target.store[RESOURCE_ENERGY] === 0) || (target.amount !== undefined && target.amount === 0)) {
                        creep.heap.targetId = null;
                        creep.heap.state = null;
                        continue;
                    }
                    if (creep.pos.isNearTo(target)) {
                        if (target.store !== undefined) {
                            creep.withdraw(target, RESOURCE_ENERGY);
                        } else if (target.amount !== undefined) {
                            creep.pickup(target);
                        }
                    } else if (!fatigueGating.isFatigued(creep)) {
                        movement.moveTo(creep, target);
                    }
                } else if (state === 'refill') {
                    if (creep.pos.isNearTo(target)) {
                        const status = creep.transfer(target, RESOURCE_ENERGY);
                        if (status === ERR_FULL) {
                            creep.heap.targetId = null;
                            creep.heap.state = null;
                        }
                    } else if (!fatigueGating.isFatigued(creep)) {
                        movement.moveTo(creep, target);
                    }
                } else if (state === 'build') {
                    if (creep.pos.inRangeTo(target, 3)) {
                        creep.build(target);
                    } else if (!fatigueGating.isFatigued(creep)) {
                        movement.moveTo(creep, target, { range: 3 });
                    }
                } else if (state === 'upgrade') {
                    if (creep.pos.inRangeTo(target, 3)) {
                        creep.upgradeController(target);
                    } else if (!fatigueGating.isFatigued(creep)) {
                        movement.moveTo(creep, target, { range: 3 });
                    }
                } else if (state === 'repair') {
                    if (creep.pos.inRangeTo(target, 3)) {
                        creep.repair(target);
                    } else if (!fatigueGating.isFatigued(creep)) {
                        movement.moveTo(creep, target, { range: 3 });
                    }
                }
            } catch (e) {
                console.log(`[worker Error] Room ${room.name}, Creep ${creep.name}: ${e.stack}`);
            }
        }
    }
};
