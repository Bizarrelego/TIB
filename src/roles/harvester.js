/**
 * @file harvester.js
 * @description Harvester role. Mines energy from sources and drops it on the ground.
 * Assignments are managed by EconomyManager.
 */

const movement = require('../utils/movement');

module.exports = {
    /**
     * Executes logic for harvester role.
     * @param {Room} room
     */
    run: function(room) {
        const roomCreeps = global.State.creepsByRoom.get(room.name);
        if (!roomCreeps) return;

        const harvesters = roomCreeps.get('harvester');
        if (!harvesters || harvesters.length === 0) return;

        for (const creep of harvesters) {
            try {
                if (creep.fatigue > 0) continue; // Fatigue gating

                const targetId = creep.heap.targetId;

                if (targetId) {
                    const target = Game.getObjectById(targetId);
                    if (target) {
                        if (creep.harvest(target) === ERR_NOT_IN_RANGE) {
                            movement.moveTo(creep, target);
                        } else {
                            if (creep.store.getFreeCapacity() === 0) {
                                creep.drop(RESOURCE_ENERGY);
                            }
                        }
                    } else {
                        creep.heap.targetId = null;
                    }
                }
            } catch (e) {
                console.log(`[Harvester Error] Room ${room.name}, Creep ${creep.name}: ${e.stack}`);
            }
        }
    }
};
