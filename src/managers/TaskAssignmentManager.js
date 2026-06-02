/**
 * Top-Down, Heap-Driven Task Assignment Manager
 * Enforces strict Drop-Mining and Stationary Upgrading
 */
class TaskAssignmentManager {
    static run() {
        global.creepHeap = global.creepHeap || {};
        const creepNames = Object.keys(Game.creeps);
        
        for (let i = 0; i < creepNames.length; i++) {
            const creep = Game.creeps[creepNames[i]];
            const roomState = global.State?.rooms?.get(creep.memory.room || creep.room.name);
            
            if (!roomState) continue;

            creep.heap = global.creepHeap[creep.name] = global.creepHeap[creep.name] || { state: 'idle', actionIntent: 'idle', targetId: null, sleepUntil: 0 };

            if (creep.heap.actionIntent !== 'idle' && creep.heap.actionIntent !== null) {
                TaskAssignmentManager.validateCurrentTask(creep);
                
                if (creep.heap.actionIntent === 'upgrade') {
                    const drop = roomState.droppedEnergy.find(d => d.pos.inRangeTo(creep.pos, 1));
                    creep.heap.secondaryTargetId = drop ? drop.id : null;
                }
                continue; 
            }

            TaskAssignmentManager.updateCreepState(creep);
            TaskAssignmentManager.assignTask(creep, roomState);
        }
    }

    static updateCreepState(creep) {
        const used = creep.store.getUsedCapacity();
        const free = creep.store.getFreeCapacity();

        if (!creep.heap.state || creep.heap.state === 'idle') {
            creep.heap.state = 'gather';
        }

        if (creep.heap.state === 'gather' && free === 0) {
            creep.heap.state = 'work';
        } else if (creep.heap.state === 'work' && used === 0) {
            creep.heap.state = 'gather';
        }
    }

    static validateCurrentTask(creep) {
        if (!creep.heap.targetId) return;
        const target = Game.getObjectById(creep.heap.targetId);
        
        if (!target) {
            creep.heap.targetId = null;
            creep.heap.actionIntent = 'idle';
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
        }
    }

    static assignHarvester(creep, roomState) {
        const sources = roomState.sources;
        if (!sources || sources.length === 0) return;

        // Sum the char codes of the unique creep name to create a proper deterministic hash
        let hash = 0;
        for (let i = 0; i < creep.name.length; i++) {
            hash += creep.name.charCodeAt(i);
        }
        
        const sourceIndex = hash % sources.length;
        creep.heap.targetId = sources[sourceIndex].id;
        creep.heap.actionIntent = 'harvest';
    }

    static assignHauler(creep, roomState) {
        if (creep.heap.state === 'gather') {
            const ruins = roomState.ruins;
            if (ruins && ruins.length > 0) {
                creep.heap.targetId = ruins[0].id;
                creep.heap.actionIntent = 'withdraw';
                return;
            }

            const tombstones = roomState.tombstones;
            if (tombstones && tombstones.length > 0) {
                creep.heap.targetId = tombstones[0].id;
                creep.heap.actionIntent = 'withdraw';
                return;
            }

            const bestDrop = TaskAssignmentManager.getLargestDrop(roomState.droppedEnergy);
            if (bestDrop) {
                creep.heap.targetId = bestDrop.id;
                creep.heap.actionIntent = 'pickup';
                return;
            }

            if (creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                creep.heap.state = 'work';
                TaskAssignmentManager.assignHaulerWork(creep, roomState);
            }
        } else {
            TaskAssignmentManager.assignHaulerWork(creep, roomState);
        }
    }

    static assignHaulerWork(creep, roomState) {
        if (TaskAssignmentManager.routeToStorage(creep, roomState)) return;

        if (roomState.controller) {
            creep.heap.targetId = roomState.controller.id;
            creep.heap.actionIntent = 'drop';
        }
    }

    static assignUpgrader(creep, roomState) {
        if (roomState.controller) {
            creep.heap.targetId = roomState.controller.id;
            creep.heap.actionIntent = 'upgrade';
        }
    }

    static assignBuilder(creep, roomState) {
        if (creep.heap.state === 'gather') {
            const bestDrop = TaskAssignmentManager.getLargestDrop(roomState.droppedEnergy);
            if (bestDrop) {
                creep.heap.targetId = bestDrop.id;
                creep.heap.actionIntent = 'pickup';
                return;
            }

            if (creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                creep.heap.state = 'work';
                TaskAssignmentManager.assignBuilderWork(creep, roomState);
            }
        } else {
            TaskAssignmentManager.assignBuilderWork(creep, roomState);
        }
    }

    static assignBuilderWork(creep, roomState) {
        const sites = roomState.constructionSites;
        if (sites && sites.length > 0) {
            creep.heap.targetId = sites[0].id;
            creep.heap.actionIntent = 'build';
            return;
        }

        if (roomState.controller) {
            creep.heap.targetId = roomState.controller.id;
            creep.heap.actionIntent = 'upgrade';
        }
    }

    static routeToStorage(creep, roomState) {
        if (roomState.spawns && roomState.spawns.length > 0) {
            const spawn = roomState.spawns[0];
            if (spawn.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                creep.heap.targetId = spawn.id;
                creep.heap.actionIntent = 'transfer';
                return true;
            }
        }

        if (roomState.extensions) {
            for (let i = 0; i < roomState.extensions.length; i++) {
                const ext = roomState.extensions[i];
                if (ext.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                    creep.heap.targetId = ext.id;
                    creep.heap.actionIntent = 'transfer';
                    return true;
                }
            }
        }
        return false;
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
}

module.exports = TaskAssignmentManager;