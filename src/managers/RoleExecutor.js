/**
 * Top-Down Role Executor
 * Processes intent execution based on static Task IDs.
 */
const CreepFatigueUtility = require('../utils/CreepFatigueUtility');
const CreepHeapUtility = require('../utils/CreepHeapUtility');
const CreepActionUtility = require('../utils/CreepActionUtility');

class RoleExecutor {
    static run() {
        Object.values(Game.creeps).forEach(creep => {
            if (creep.spawning) return;

            if (CreepFatigueUtility.checkFatigue(creep)) return;

            if (!creep.heap || creep.heap instanceof Map || typeof creep.heap !== 'object') {
                creep.heap = CreepHeapUtility.getDefaultHeap();
            }

            CreepActionUtility.executeAction(creep);
        });
    }
}

module.exports = RoleExecutor;
