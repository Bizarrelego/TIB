/**
 * Top-Down, Heap-Driven Task Assignment Manager
 * Optimized for RCL2+ (Extensions, Builders, Overflow Pipelines, Remote Scavenging)
 */

const TASKS = {
    IDLE: 0,
    HARVEST: 1,
    PICKUP: 2,
    TRANSFER: 3,
    UPGRADE: 4,
    WITHDRAW: 5,
    BUILD: 6,
    DROP: 7,
    SCOUT: 8,
    MOVE_ROOM: 9 // New Task for Remote Routing
};

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

            if (!creep.memory.targetId && creep.memory.taskId !== TASKS.MOVE_ROOM && creep.memory.taskId !== TASKS.SCOUT) {
                TaskAssignmentManager.assignTask(creep, roomState);
            }
        }
    }

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

        if (state === STATES.GATHER && free === 0) {
            state = STATES.WORK;
        } else if (state === STATES.WORK && used === 0) {
            state = STATES.GATHER;
        }

        if (role === 'harvester') {
            const haulers = roomState.creepCounts?.hauler || 0;
            if (haulers > 0) {
                state = STATES.GATHER; 
            }
        }

        if (role === 'hauler' && state === STATES.GATHER && used > 0) {
            const dropped = roomState.droppedEnergy?.length || 0;
            const ruins = roomState.ruins?.length || 0;
            // Prevent dropping gather state if we are remote scavenging
            if (dropped === 0 && ruins === 0 && creep.room.name === creep.memory.room) {
                state = STATES.WORK; 
            }
        }

        if (state !== creep.memory.state) {
            creep.memory.state = state;
            creep.memory.targetId = null;
            creep.memory.taskId = TASKS.IDLE;
            // Reset target room to home room when state flips
            if (role !== 'scout') {
                 creep.memory.targetRoom = creep.memory.room;
            }
        }
    }

    static validateCurrentTask(creep) {
        if (!creep.memory.targetId) return;

        // Skip validation if the target is in another room and we aren't there yet
        const target = Game.getObjectById(creep.memory.targetId);
        if (!target && creep.room.name === creep.memory.targetRoom) {
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
        if (creep.memory.targetRoom && creep.memory.targetRoom !== creep.room.name) {
            creep.memory.taskId = TASKS.SCOUT;
            return;
        }

        if (global.State.scoutQueue && global.State.scoutQueue.length > 0) {
            creep.memory.targetRoom = global.State.scoutQueue[0];
            creep.memory.taskId = TASKS.SCOUT;
        } else {
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
            TaskAssignmentManager.routeToStorage(creep, roomState);
        }
    }

    static assignHauler(creep, roomState) {
        if (creep.memory.state === STATES.GATHER) {
            // Priority 1: Check Local Drops
            const bestDrop = TaskAssignmentManager.getLargestDrop(roomState.droppedEnergy);
            if (bestDrop) {
                creep.memory.targetId = bestDrop.id;
                creep.memory.taskId = TASKS.PICKUP;
                creep.memory.targetRoom = creep.room.name;
                return;
            }

            const ruins = roomState.ruins;
            if (ruins && ruins.length > 0) {
                creep.memory.targetId = ruins[0].id;
                creep.memory.taskId = TASKS.PICKUP;
                creep.memory.targetRoom = creep.room.name;
                return;
            }

            // Priority 2: Remote Scavenging
            // If home room is clean, check Intel for adjacent rooms with drops
            if (creep.room.name === creep.memory.room) {
                 const remoteTarget = TaskAssignmentManager.findRemoteScavengeTarget(creep.memory.room);
                 if (remoteTarget) {
                     creep.memory.targetRoom = remoteTarget;
                     creep.memory.taskId = TASKS.MOVE_ROOM;
                     return;
                 }
            }
        } else {
            // Delivering: Must happen in home room.
            if (creep.room.name !== creep.memory.room) {
                 creep.memory.targetRoom = creep.memory.room;
                 creep.memory.taskId = TASKS.MOVE_ROOM;
                 return;
            }

            if (TaskAssignmentManager.routeToStorage(creep, roomState)) return;

            if (roomState.controller) {
                creep.memory.targetId = roomState.controller.id;
                creep.memory.taskId = TASKS.DROP;
            }
        }
    }

    /**
     * Checks Memory for adjacent rooms with energy and no hostiles.
     * @param {string} homeRoom 
     */
    static findRemoteScavengeTarget(homeRoom) {
        const exits = Game.map.describeExits(homeRoom);
        if (!exits) return null;

        const exitRooms = Object.values(exits);
        for (let i = 0; i < exitRooms.length; i++) {
            const adj = exitRooms[i];
            const mem = Memory.rooms[adj];
            
            // Ensure no hostiles exist before sending civilian creeps
            if (mem && mem.droppedEnergy > 100 && (!mem.controller.owner || mem.controller.owner === 'None')) {
                const isSafe = mem.hostiles.creeps === 0 && mem.hostiles.towers === 0 && !mem.hostiles.invaderCore;
                if (isSafe) {
                    return adj;
                }
            }
        }
        return null;
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

            if (roomState.controller) {
                creep.memory.targetId = roomState.controller.id;
                creep.memory.taskId = TASKS.UPGRADE;
            }
        }
    }

    static assignUpgrader(creep, roomState) {
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
            if (roomState.controller) {
                creep.memory.targetId = roomState.controller.id;
                creep.memory.taskId = TASKS.UPGRADE;
            }
        }
    }

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