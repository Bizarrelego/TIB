/**
 * @file worker.js
 * @description Multi-tool fallback (Harvest/Build/Upgrade). Replaced by dedicated roles.
 */

const movement = require('../utils/movement');

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

        for (const creep of workers) {
            try {
                if (creep.fatigue > 0) continue; // Fatigue gating

                const state = creep.heap.state;
                const targetId = creep.heap.targetId;

                if (!state || !targetId) continue;

                const target = Game.getObjectById(targetId);
                if (!target) {
                    creep.heap.targetId = null;
                    continue;
                }

                if (state === 'harvest') {
                    if (creep.harvest(target) === ERR_NOT_IN_RANGE) {
                        movement.moveTo(creep, target);
                    }
                } else if (state === 'pickup') {
                    let res = OK;
                    if (target instanceof Resource) {
                        res = creep.pickup(target);
                    } else {
                        res = creep.withdraw(target, RESOURCE_ENERGY);
                    }
                    if (res === ERR_NOT_IN_RANGE) {
                        movement.moveTo(creep, target);
                    }
                } else if (state === 'repair') {
                    if (creep.repair(target) === ERR_NOT_IN_RANGE) {
                        movement.moveTo(creep, target);
                    }
                } else if (state === 'refill') {
                    if (creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                        movement.moveTo(creep, target);
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
                console.error(`[worker Error] Room ${room.name}, Creep ${creep.name}: ${e.stack}`);
            }
        }
    }
};
