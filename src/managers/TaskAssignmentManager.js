/**
 * Top-Down, Heap-Driven Task Assignment Manager
 * Optimized for RCL2+ (Extensions, Builders, Overflow Pipelines)
 */

// V8 Optimization: Integer constants for task routing.
const TASKS = {
    IDLE: 0,
    HARVEST: 1,
    PICKUP: 2,
    TRANSFER: 3,
    UPGRADE: 4,
    WITHDRAW: 5,
    BUILD: 6,
    DROP: 7,
    SCOUT: 8
};

// V8 Optimization: Integer constants for capacity state machine.
const STATES = {
    GATHER: 0,
    WORK: 1
};

class TaskAssignmentManager {
    static run() {
        const creepNames = Object.keys(Game.creeps);
        
        for (let i = 0; i < creepNames.length; i++) {
            const creep = Game.creeps[creepNames[i]];
            const roomState = global.State?.rooms?.get(creep.memory.room || creep.room.name);
            
            if (!roomState) continue;

            TaskAssignmentManager.updateCreepState(creep, roomState);
            TaskAssignmentManager.validateCurrentTask(creep);

            if (!creep.memory.targetId) {
                TaskAssignmentManager.assignTask(creep, roomState);
            }
        }
    }

    /**
     * Finds the largest dropped energy pile in O(N) time.
     * Replaces Array.sort() to eliminate memory allocation and GC overhead.
     */
    static getLargestDrop(drops) {
        if (!drops || drops.length === 0) return null;
        let maxDrop = drops[0];
        for (let i = 1; i < drops.length; i++) {
            if (drops[i].amount > maxDrop.amount) {
                maxDrop = drops[i];
            }
        }
        return maxDrop;
    }

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

        // Harvester Override: Ferry energy manually if no haulers exist.
        if (role === 'harvester') {
            const haulers = roomState.creepCounts?.hauler || 0;
            if (haulers > 0) {
                state = STATES.GATHER; 
            }
        }

        // Hauler Override: Deliver if partially full and the floor is clean.
        if (role === 'hauler' && state === STATES.GATHER && used > 0) {
            const dropped = roomState.droppedEnergy?.length || 0;
            const ruins = roomState.ruins?.length || 0;
            if (dropped === 0 && ruins === 0) {
                state = STATES.WORK; 
            }
        }

        if (state !== creep.memory.state) {
            creep.memory.state = state;
            creep.memory.targetId = null;
            creep.memory.taskId = TASKS.IDLE;
        }
    }

    static validateCurrentTask(creep) {
        if (!creep.memory.targetId) return;

        const target = Game.getObjectById(creep.memory.targetId);
        
        // Construction sites disappear when finished. Check validity.
        if (!target) {
            creep.memory.targetId = null;
            creep.memory.taskId = TASKS.IDLE;
        }
    }

    static assignTask(creep, roomState) {
        const role = creep.memory.role;
        
        if (role === 'harvester') {
            TaskAssignmentManager.assignHarvester(creep, roomState);
        } else if (role === 'hauler') {
            TaskAssignmentManager.assignHauler(creep, roomState);
        } else if (role === 'upgrader') {
            TaskAssignmentManager.assignUpgrader(creep, roomState);
        } else if (role === 'builder') {
            TaskAssignmentManager.assignBuilder(creep, roomState);
        } else if (role === 'scout') {
            TaskAssignmentManager.assignScout(creep);
        }
    }

    static assignScout(creep) {
        // Optimization: Do not re-assign if they already have a valid target room that isn't finished.
        if (creep.memory.targetRoom && creep.memory.targetRoom !== creep.room.name) {
            creep.memory.taskId = TASKS.SCOUT;
            return;
        }

        // Target reached or no target. Pull from the IntelManager queue.
        if (global.State.scoutQueue && global.State.scoutQueue.length > 0) {
            // Take the first room in the queue and assign it.
            // When the scout enters the room, IntelManager will see it next tick, update Memory, 
            // and the room will drop out of the scoutQueue automatically.
            creep.memory.targetRoom = global.State.scoutQueue[0];
            creep.memory.taskId = TASKS.SCOUT;
        } else {
            // Nothing to scout.
            creep.memory.targetRoom = null;
            creep.memory.taskId = TASKS.IDLE;
        }
    }

    static assignHarvester(creep, roomState) {
        if (creep.memory.state === STATES.GATHER) {
            const sources = roomState.sources;
            if (!sources || sources.length === 0) return;

            const sourceIndex = creep.name.length % sources.length;
            creep.memory.targetId = sources[sourceIndex].id;
            creep.memory.taskId = TASKS.HARVEST;
        } else {
            // Bootstrapping override: Fill Extensions -> Spawns
            TaskAssignmentManager.routeToStorage(creep, roomState);
        }
    }

    static assignHauler(creep, roomState) {
        if (creep.memory.state === STATES.GATHER) {
            const bestDrop = TaskAssignmentManager.getLargestDrop(roomState.droppedEnergy);
            if (bestDrop) {
                creep.memory.targetId = bestDrop.id;
                creep.memory.taskId = TASKS.PICKUP;
                return;
            }

            const ruins = roomState.ruins;
            if (ruins && ruins.length > 0) {
                creep.memory.targetId = ruins[0].id;
                creep.memory.taskId = TASKS.PICKUP;
            }
        } else {
            // Priority 1: Extensions & Spawns
            if (TaskAssignmentManager.routeToStorage(creep, roomState)) return;

            // Priority 2: Overflow to Controller
            if (roomState.controller) {
                creep.memory.targetId = roomState.controller.id;
                creep.memory.taskId = TASKS.DROP;
            }
        }
    }

    static assignBuilder(creep, roomState) {
        if (creep.memory.state === STATES.GATHER) {
            const bestDrop = TaskAssignmentManager.getLargestDrop(roomState.droppedEnergy);
            if (bestDrop) {
                creep.memory.targetId = bestDrop.id;
                creep.memory.taskId = TASKS.PICKUP;
                return;
            }

            const spawns = roomState.spawns;
            if (spawns && spawns.length > 0 && spawns[0].store.getUsedCapacity(RESOURCE_ENERGY) > 100) {
                creep.memory.targetId = spawns[0].id;
                creep.memory.taskId = TASKS.WITHDRAW;
            }
        } else {
            const sites = roomState.constructionSites;
            if (sites && sites.length > 0) {
                creep.memory.targetId = sites[0].id;
                creep.memory.taskId = TASKS.BUILD;
                return;
            }

            // Fallback to upgrading if no construction sites exist
            if (roomState.controller) {
                creep.memory.targetId = roomState.controller.id;
                creep.memory.taskId = TASKS.UPGRADE;
            }
        }
    }

    static assignUpgrader(creep, roomState) {
        if (creep.memory.state === STATES.GATHER) {
            // Upgraders rely on haulers dropping energy at the controller.
            const bestDrop = TaskAssignmentManager.getLargestDrop(roomState.droppedEnergy);
            if (bestDrop) {
                creep.memory.targetId = bestDrop.id;
                creep.memory.taskId = TASKS.PICKUP;
                return;
            }

            const spawns = roomState.spawns;
            if (spawns && spawns.length > 0 && spawns[0].store.getUsedCapacity(RESOURCE_ENERGY) > 100) {
                creep.memory.targetId = spawns[0].id;
                creep.memory.taskId = TASKS.WITHDRAW;
            }
        } else {
            if (roomState.controller) {
                creep.memory.targetId = roomState.controller.id;
                creep.memory.taskId = TASKS.UPGRADE;
            }
        }
    }

    /**
     * Shared routing logic for filling Extensions then Spawns.
     * Returns true if a target was found, false otherwise.
     */
    static routeToStorage(creep, roomState) {
        if (roomState.extensions) {
            for (let i = 0; i < roomState.extensions.length; i++) {
                const ext = roomState.extensions[i];
                if (ext.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                    creep.memory.targetId = ext.id;
                    creep.memory.taskId = TASKS.TRANSFER;
                    return true;
                }
            }
        }

        if (roomState.spawns && roomState.spawns.length > 0) {
            const spawn = roomState.spawns[0];
            if (spawn.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                creep.memory.targetId = spawn.id;
                creep.memory.taskId = TASKS.TRANSFER;
                return true;
            }
        }

        return false;
    }
}

TaskAssignmentManager.TASKS = TASKS;
TaskAssignmentManager.STATES = STATES;

module.exports = TaskAssignmentManager;