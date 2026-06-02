/**
 * Top-Down Role Executor
 * Processes intent execution based on static Task IDs.
 */
const TaskAssignmentManager = require('./TaskAssignmentManager');
const CreepFatigueUtility = require('../utils/CreepFatigueUtility');
const CreepHeapUtility = require('../utils/CreepHeapUtility');

class RoleExecutor {
    static run() {
        Object.values(Game.creeps).forEach(creep => {
            if (creep.spawning) return;

            if (CreepFatigueUtility.checkFatigue(creep)) return;

            if (!creep.heap || creep.heap instanceof Map || typeof creep.heap !== 'object') {
                creep.heap = CreepHeapUtility.getDefaultHeap();
            }

            try {
                const roleModule = require('../roles/' + creep.memory.role);
                roleModule.run(creep);
            } catch (e) {
                console.log(`[RoleExecutor] Error executing role ${creep.memory.role} for creep ${creep.name}: ${e.message}`);
            }
        });
    }
}

module.exports = RoleExecutor;