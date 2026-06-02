/**
 * Top-Down, Heap-Driven Task Assignment Manager
 * Replaces all serialized Memory queues.
 */

// V8 Optimization: Integer constants for task routing.
const TASKS = {
    IDLE: 0,
    HARVEST: 1,
    PICKUP: 2,
    TRANSFER: 3,
    UPGRADE: 4,
    WITHDRAW: 5
};

// V8 Optimization: Integer constants for capacity state machine.
const STATES = {
    GATHER: 0,
    WORK: 1
};

class TaskAssignmentManager {
    /**
     * Iterates all creeps and assigns tasks based on O(1) heap state.
     * Must run AFTER GlobalStateScanner and BEFORE RoleExecutor.
     */
    static run() {
        const creepNames = Object.keys(Game.creeps);
        
        for (let i = 0; i < creepNames.length; i++) {
            const creep = Game.creeps[creepNames[i]];
            const roomState = global.State?.rooms?.get(creep.memory.room || creep.room.name);
            
            if (!roomState) continue;

            this.updateCreepState(creep, roomState);
            this.validateCurrentTask(creep);

            if (!creep.memory.targetId) {
                this.assignTask(creep, roomState);
            }
        }
    }

    /**
     * Rigid state machine controlling Gather vs Deliver logic.
     * Evaluates capacity and overrides before routing.
     * @param {Creep} creep 
     * @param {Object} roomState 
     */
    static updateCreepState(creep, roomState) {
        const role = creep.memory.role;
        const used = creep.store.getUsedCapacity();
        const free = creep.store.getFreeCapacity();
        
        let state = creep.memory.state;

        // Standard Capacity Transitions
        if (state === STATES.GATHER && free === 0) {
            state = STATES.WORK;
        } else if (state === STATES.WORK && used === 0) {
            state = STATES.GATHER;
        }

        // Harvester Override: If no haulers exist, ferry energy manually to avoid passive spawn waits.
        if (role === 'harvester') {
            const haulers = roomState.creepCounts?.hauler || 0;
            if (haulers > 0) {
                state = STATES.GATHER; // Lock to purely mining once haulers exist
            }
        }

        // Hauler Override: If partially full and nothing left to gather, go deliver.
        if (role === 'hauler' && state === STATES.GATHER && used > 0) {
            const dropped = roomState.droppedEnergy?.length || 0;
            const ruins = roomState.ruins?.length || 0;
            if (dropped === 0 && ruins === 0) {
                state = STATES.WORK; 
            }
        }

        // If state changed, DESTROY the current target to force reassignment.
        if (state !== creep.memory.state) {
            creep.memory.state = state;
            creep.memory.targetId = null;
            creep.memory.taskId = TASKS.IDLE;
        }
    }

    /**
     * Validates if the current target still exists in the engine.
     * @param {Creep} creep 
     */
    static validateCurrentTask(creep) {
        if (!creep.memory.targetId) return;

        // Fast internal C++ cache lookup
        const target = Game.getObjectById(creep.memory.targetId);
        
        if (!target) {
            creep.memory.targetId = null;
            creep.memory.taskId = TASKS.IDLE;
        }
    }

    /**
     * Routes the creep to the correct target based on its rigid state.
     * @param {Creep} creep 
     * @param {Object} roomState 
     */
    static assignTask(creep, roomState) {
        const role = creep.memory.role;
        
        if (role === 'harvester') {
            this.assignHarvester(creep, roomState);
        } else if (role === 'hauler') {
            this.assignHauler(creep, roomState);
        } else if (role === 'upgrader') {
            this.assignUpgrader(creep, roomState);
        }
    }

    static assignHarvester(creep, roomState) {
        if (creep.memory.state === STATES.GATHER) {
            const sources = roomState.sources;
            if (!sources || sources.length === 0) return;

            // Static load balancing based on name length
            const sourceIndex = creep.name.length % sources.length;
            creep.memory.targetId = sources[sourceIndex].id;
            creep.memory.taskId = TASKS.HARVEST;
        } else {
            // Delivering (Bootstrapping override)
            const spawns = roomState.spawns;
            if (spawns && spawns.length > 0) {
                creep.memory.targetId = spawns[0].id;
                creep.memory.taskId = TASKS.TRANSFER;
            }
        }
    }

    static assignHauler(creep, roomState) {
        if (creep.memory.state === STATES.GATHER) {
            // Priority 1: Pickup largest dropped energy piles.
            const dropped = roomState.droppedEnergy;
            if (dropped && dropped.length > 0) {
                dropped.sort((a, b) => b.amount - a.amount);
                creep.memory.targetId = dropped[0].id;
                creep.memory.taskId = TASKS.PICKUP;
                return;
            }

            // Priority 2: Ruins
            const ruins = roomState.ruins;
            if (ruins && ruins.length > 0) {
                creep.memory.targetId = ruins[0].id;
                creep.memory.taskId = TASKS.PICKUP;
            }
        } else {
            // Priority 1: Fill Spawn
            const spawns = roomState.spawns;
            if (spawns && spawns.length > 0) {
                // Always target the spawn. If full, they will wait next to it.
                // Do not assign Upgrading to haulers. They lack WORK parts.
                creep.memory.targetId = spawns[0].id;
                creep.memory.taskId = TASKS.TRANSFER;
            }
        }
    }

    static assignUpgrader(creep, roomState) {
        if (creep.memory.state === STATES.GATHER) {
            // Priority 1: Scavenge dynamically.
            const dropped = roomState.droppedEnergy;
            if (dropped && dropped.length > 0) {
                creep.memory.targetId = dropped[0].id;
                creep.memory.taskId = TASKS.PICKUP;
                return;
            }

            // Priority 2: Withdraw from spawn (Utilize the spawn as a container at RCL1)
            const spawns = roomState.spawns;
            if (spawns && spawns.length > 0 && spawns[0].store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                creep.memory.targetId = spawns[0].id;
                creep.memory.taskId = TASKS.WITHDRAW;
            }
        } else {
            // Work state
            if (roomState.controller) {
                creep.memory.targetId = roomState.controller.id;
                creep.memory.taskId = TASKS.UPGRADE;
            }
        }
    }
}

// Attach constants to the class for external access if needed by RoleExecutor
TaskAssignmentManager.TASKS = TASKS;
TaskAssignmentManager.STATES = STATES;

module.exports = TaskAssignmentManager;