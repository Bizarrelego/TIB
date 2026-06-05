
const ActionConstants = require('../constants/ActionConstants');
const CreepHeapUtility = require('../utilities/CreepHeapUtility');

/**
 * Top-Down, Heap-Driven Task Assignment Manager
 * Optimized for strict Drop-Mining, Stationary Upgrading, and Distance-Weighted Hauling.
 */
class TaskAssignmentManager {
    static run() {
        if (!global.creepHeap) global.creepHeap = new Map();
        
        const creeps = Object.values(Game.creeps);
        
        for (let i = 0; i < creeps.length; i++) {
            const creep = creeps[i];
            
            const roomName = creep.memory.room || creep.room.name;
            const roomState = global.State?.rooms?.get(roomName);
            if (!roomState) continue;

            let heap = global.creepHeap.get(creep.name);
            if (!heap) {
                heap = CreepHeapUtility.getDefaultHeap();
                heap.set('secondaryTargetId', null);
                global.creepHeap.set(creep.name, heap);
            }
            creep.heap = heap;

            if (creep.heap.get('actionIntent') !== ActionConstants.ACTION_IDLE && creep.heap.get('actionIntent') !== null) {
                TaskAssignmentManager.validateCurrentTask(creep);
                
                if (creep.heap.get('actionIntent') !== ActionConstants.ACTION_IDLE) {
                    if (creep.heap.get('actionIntent') === ActionConstants.ACTION_UPGRADE) {
                        const drop = roomState.droppedEnergy?.find(d => creep.pos.getRangeTo(d) <= 3);
                        creep.heap.set('secondaryTargetId', drop ? drop.id : null);
                    }
                    TaskAssignmentManager.reregisterClaim(creep);
                    continue; 
                }
            }

            TaskAssignmentManager.updateCreepState(creep);
            TaskAssignmentManager.assignTask(creep, roomState);
        }
    }

    static reregisterClaim(creep) {
        if (!creep.heap.get('targetId')) return;
        const target = Game.getObjectById(creep.heap.get('targetId'));
        if (!target) return;

        // Check: Replaced Map claims with tick-volatile object properties to optimize CPU.
        if (creep.heap.get('state') === 'gather') {
            target.__gatherClaimed = (target.__gatherClaimed || 0) + creep.store.getFreeCapacity();
        } else if (creep.heap.get('state') === 'work' && (creep.heap.get('actionIntent') === ActionConstants.ACTION_TRANSFER || creep.heap.get('actionIntent') === ActionConstants.ACTION_BUILD)) {
            target.__deliveryClaimed = (target.__deliveryClaimed || 0) + creep.store.getUsedCapacity(RESOURCE_ENERGY);
        }
    }

    static updateCreepState(creep) {
        const used = creep.store.getUsedCapacity(RESOURCE_ENERGY);
        const free = creep.store.getFreeCapacity(RESOURCE_ENERGY);

        if (!creep.heap.get('state') || creep.heap.get('state') === 'idle') creep.heap.set('state', 'gather');

        if (creep.heap.get('state') === 'gather' && free === 0) {
            creep.heap.set('state', 'work');
            creep.heap.set('targetId', null);
        } else if (creep.heap.get('state') === 'work' && used === 0) {
            creep.heap.set('state', 'gather');
            creep.heap.set('targetId', null);
        }
    }

    static validateCurrentTask(creep) {
        if (!creep.heap.get('targetId')) return;
        const target = Game.getObjectById(creep.heap.get('targetId'));
        
        if (!target) {
            creep.heap.set('targetId', null);
            creep.heap.set('actionIntent', ActionConstants.ACTION_IDLE);
            return;
        }

        if (creep.heap.get('state') === 'gather') {
            if ((target.amount !== undefined && target.amount < 50) || 
                (target.store && target.store.getUsedCapacity(RESOURCE_ENERGY) < 50)) {
                creep.heap.set('targetId', null);
                creep.heap.set('actionIntent', ActionConstants.ACTION_IDLE);
            }
        } else if (creep.heap.get('state') === 'work') {
            if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0 || 
               (target.store && target.store.getFreeCapacity(RESOURCE_ENERGY) === 0)) {
                creep.heap.set('targetId', null);
                creep.heap.set('actionIntent', ActionConstants.ACTION_IDLE);
            }
        }
    }

    static assignTask(creep, roomState) {
        const role = creep.memory.role;
        if (role === 'harvester') TaskAssignmentManager.assignHarvester(creep, roomState);
        else if (role === 'hauler') TaskAssignmentManager.assignHauler(creep, roomState);
        else if (role === 'upgrader') TaskAssignmentManager.assignUpgrader(creep, roomState);
        else if (role === 'builder') TaskAssignmentManager.assignBuilder(creep, roomState);
    }

    static assignHarvester(creep, roomState) {
        const sources = roomState.sources;
        if (!sources || sources.length === 0) return;

        // Check: Removed string hashing loop. O(1) modulus assignment optimizes performance.
        const source = sources[creep.name.length % sources.length];
        creep.heap.set('targetId', source.id);
        creep.heap.set('actionIntent', ActionConstants.ACTION_HARVEST);

        if (!creep.heap.get('sitTargetId') && roomState.sourceContainers?.length) {
            const container = roomState.sourceContainers.find(c => creep.pos.getRangeTo(c) <= 2);
            if (container) creep.heap.set('sitTargetId', container.id);
        }
    }

    static assignHauler(creep, roomState) {
        if (creep.heap.get('state') === 'gather') {
            let bestTarget = null;
            let bestScore = -1;
            let intent = '';

            const evaluateTarget = (target, amount, actionIntent) => {
                const claimed = target.__gatherClaimed || 0;
                const remaining = amount - claimed;
                
                if (remaining >= Math.min(50, creep.store.getFreeCapacity(RESOURCE_ENERGY))) {
                    // Check: Chebyshev distance approximation (Math.max) is cheaper than native getRangeTo pathing overhead.
                    const dx = creep.pos.x - target.pos.x;
                    const dy = creep.pos.y - target.pos.y;
                    const distance = Math.max(Math.abs(dx), Math.abs(dy)) || 1;
                    
                    const score = remaining / distance;
                    if (score > bestScore) {
                        bestScore = score;
                        bestTarget = target;
                        intent = actionIntent;
                    }
                }
            };

            roomState.tombstones?.forEach(t => evaluateTarget(t, t.store.getUsedCapacity(RESOURCE_ENERGY), ActionConstants.ACTION_WITHDRAW));
            roomState.ruins?.forEach(r => evaluateTarget(r, r.store.getUsedCapacity(RESOURCE_ENERGY), ActionConstants.ACTION_WITHDRAW));
            roomState.sourceContainers?.forEach(c => evaluateTarget(c, c.store.getUsedCapacity(RESOURCE_ENERGY), ActionConstants.ACTION_WITHDRAW));
            roomState.droppedEnergy?.forEach(d => evaluateTarget(d, d.amount, ActionConstants.ACTION_PICKUP));

            if (bestTarget) {
                bestTarget.__gatherClaimed = (bestTarget.__gatherClaimed || 0) + creep.store.getFreeCapacity(RESOURCE_ENERGY);
                creep.heap.set('targetId', bestTarget.id);
                creep.heap.set('actionIntent', intent);
                return;
            }

            if (creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                creep.heap.set('state', 'work');
                TaskAssignmentManager.assignHaulerWork(creep, roomState);
            }
        } else {
            TaskAssignmentManager.assignHaulerWork(creep, roomState);
        }
    }

    static assignHaulerWork(creep, roomState) {
        if (TaskAssignmentManager.routeToStorage(creep, roomState)) return;

        if (roomState.controller) {
            if (roomState.controllerContainers?.length > 0) {
                const target = roomState.controllerContainers[0];
                const claimed = target.__deliveryClaimed || 0;
                const remainingSpace = target.store.getFreeCapacity(RESOURCE_ENERGY) - claimed;
                
                if (remainingSpace > 0) {
                    target.__deliveryClaimed = claimed + creep.store.getUsedCapacity(RESOURCE_ENERGY);
                    creep.heap.set('targetId', target.id);
                    creep.heap.set('actionIntent', ActionConstants.ACTION_TRANSFER);
                    return;
                }
            }

            creep.heap.set('targetId', roomState.controller.id);
            creep.heap.set('actionIntent', ActionConstants.ACTION_DROP);
        }
    }

    static assignUpgrader(creep, roomState) {
        if (roomState.controller) {
            creep.heap.set('targetId', roomState.controller.id);
            creep.heap.set('actionIntent', ActionConstants.ACTION_UPGRADE);

            if (!creep.heap.get('sitTargetId') && roomState.controllerContainers?.length > 0) {
                creep.heap.set('sitTargetId', roomState.controllerContainers[0].id);
            }
        }
    }

    static assignBuilder(creep, roomState) {
        if (creep.heap.get('state') === 'gather') {
            if (roomState.spawns?.length > 0 && roomState.spawns[0].store.getUsedCapacity(RESOURCE_ENERGY) > 100) {
                creep.heap.set('targetId', roomState.spawns[0].id);
                creep.heap.set('actionIntent', ActionConstants.ACTION_WITHDRAW);
                return;
            }
            
            if (roomState.droppedEnergy?.length > 0) {
                let maxDrop = roomState.droppedEnergy[0];
                for (let i = 1; i < roomState.droppedEnergy.length; i++) {
                    if (roomState.droppedEnergy[i].amount > maxDrop.amount) maxDrop = roomState.droppedEnergy[i];
                }
                creep.heap.set('targetId', maxDrop.id);
                creep.heap.set('actionIntent', ActionConstants.ACTION_PICKUP);
                return;
            }

            if (creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                creep.heap.set('state', 'work');
                TaskAssignmentManager.assignBuilderWork(creep, roomState);
            }
        } else {
            TaskAssignmentManager.assignBuilderWork(creep, roomState);
        }
    }

    static assignBuilderWork(creep, roomState) {
        if (roomState.repairTargets?.length > 0) {
            // Check: Replaced array loop with pos.findClosestByRange for faster engine-side C++ execution.
            const closest = creep.pos.findClosestByRange(roomState.repairTargets);
            if (closest) {
                creep.heap.set('targetId', closest.id);
                creep.heap.set('actionIntent', ActionConstants.ACTION_REPAIR);
                return;
            }
        }

        if (roomState.constructionSites?.length > 0) {
            const closestSite = creep.pos.findClosestByRange(roomState.constructionSites);
            if (closestSite) {
                creep.heap.set('targetId', closestSite.id);
                creep.heap.set('actionIntent', ActionConstants.ACTION_BUILD);
                return;
            }
        }

        if (roomState.controller) {
            creep.heap.set('targetId', roomState.controller.id);
            creep.heap.set('actionIntent', ActionConstants.ACTION_UPGRADE);
        }
    }

    static routeToStorage(creep, roomState) {
        let bestTarget = null;
        let bestScore = -1;

        const evaluateTarget = (target) => {
            const freeCapacity = target.store.getFreeCapacity(RESOURCE_ENERGY);
            if (freeCapacity === 0) return;

            const claimed = target.__deliveryClaimed || 0;
            const remainingSpace = freeCapacity - claimed;
            if (remainingSpace <= 0) return;

            const dx = creep.pos.x - target.pos.x;
            const dy = creep.pos.y - target.pos.y;
            const distance = Math.max(Math.abs(dx), Math.abs(dy)) || 1;
            const score = 1000 / distance; 
            
            if (score > bestScore) {
                bestScore = score;
                bestTarget = target;
            }
        };

        roomState.spawns?.forEach(evaluateTarget);
        roomState.extensions?.forEach(evaluateTarget);

        if (bestTarget) {
            bestTarget.__deliveryClaimed = (bestTarget.__deliveryClaimed || 0) + creep.store.getUsedCapacity(RESOURCE_ENERGY);
            creep.heap.set('targetId', bestTarget.id);
            creep.heap.set('actionIntent', ActionConstants.ACTION_TRANSFER);
            return true;
        }

        return false;
    }
}

module.exports = TaskAssignmentManager;