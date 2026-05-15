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
                        let res = OK;
                        if (target instanceof Resource) {
                            res = creep.pickup(target);
                        } else {
                            res = creep.withdraw(target, RESOURCE_ENERGY);
                        }
                        if (res === ERR_NOT_IN_RANGE) {
                            movement.moveTo(creep, target);
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
                    if (creep.harvest(target) === ERR_NOT_IN_RANGE) {
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
