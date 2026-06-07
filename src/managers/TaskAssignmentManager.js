
const ActionConstants = require('../constants/ActionConstants');
const CreepHeapUtility = require('../utilities/CreepHeapUtility');
const WithdrawTargetUtility = require('../utilities/WithdrawTargetUtility');
const GameObjectUtility = require('../utilities/GameObjectUtility');

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
                heap.secondaryTargetId = null;
                global.creepHeap.set(creep.name, heap);
            }
            creep.heap = heap;

            if (creep.heap.actionIntent !== ActionConstants.ACTION_IDLE && creep.heap.actionIntent !== null) {
                TaskAssignmentManager.validateCurrentTask(creep);
                
                if (creep.heap.actionIntent !== ActionConstants.ACTION_IDLE) {
                    if (creep.heap.actionIntent === ActionConstants.ACTION_UPGRADE) {
                        const drop = roomState.droppedEnergy?.find(d => creep.pos.getRangeTo(d) <= 3);
                        creep.heap.secondaryTargetId = drop ? drop.id : null;
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
        if (!creep.heap.targetId) return;
        const target = GameObjectUtility.getById(creep.heap.targetId);
        if (!target) return;

        // Check: Replaced Map claims with tick-volatile object properties to optimize CPU.
        if (creep.heap.state === 'gather') {
            target.__gatherClaimed = (target.__gatherClaimed || 0) + creep.store.getFreeCapacity();
        } else if (creep.heap.state === 'work' && (creep.heap.actionIntent === ActionConstants.ACTION_TRANSFER || creep.heap.actionIntent === ActionConstants.ACTION_BUILD)) {
            target.__deliveryClaimed = (target.__deliveryClaimed || 0) + creep.store.getUsedCapacity(RESOURCE_ENERGY);
        }
    }

    static updateCreepState(creep) {
        const used = creep.store.getUsedCapacity(RESOURCE_ENERGY);
        const free = creep.store.getFreeCapacity(RESOURCE_ENERGY);

        if (!creep.heap.state || creep.heap.state === 'idle') creep.heap.state = 'gather';

        if (creep.heap.state === 'gather' && free === 0) {
            creep.heap.state = 'work';
            creep.heap.targetId = null;
        } else if (creep.heap.state === 'work' && used === 0) {
            creep.heap.state = 'gather';
            creep.heap.targetId = null;
        }
    }

    static validateCurrentTask(creep) {
        if (!creep.heap.targetId) return;
        const target = GameObjectUtility.getById(creep.heap.targetId);
        
        if (!target) {
            creep.heap.targetId = null;
            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
            return;
        }

        if (creep.heap.state === 'gather') {
            if ((target.amount !== undefined && target.amount < 50) || 
                (target.store && target.store.getUsedCapacity(RESOURCE_ENERGY) < 50)) {
                creep.heap.targetId = null;
                creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
            }
        } else if (creep.heap.state === 'work') {
            if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0 || 
               (target.store && target.store.getFreeCapacity(RESOURCE_ENERGY) === 0)) {
                creep.heap.targetId = null;
                creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
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
        creep.heap.targetId = source.id;
        creep.heap.actionIntent = ActionConstants.ACTION_HARVEST;

        if (!creep.heap.sitTargetId && roomState.sourceContainers?.length) {
            const container = roomState.sourceContainers.find(c => creep.pos.getRangeTo(c) <= 2);
            if (container) creep.heap.sitTargetId = container.id;
        }
    }

    static assignHauler(creep, roomState) {
        if (creep.heap.state === 'gather') {
            // Check: Prioritize Ruin and Tombstone objects explicitly for Scavenging
            const scavengeTargets = WithdrawTargetUtility.getScavengeTargets(roomState);

            for (let i = 0; i < scavengeTargets.length; i++) {
                const target = scavengeTargets[i];
                const amount = target.store.getUsedCapacity(RESOURCE_ENERGY);
                const claimed = target.__gatherClaimed || 0;
                const remaining = amount - claimed;

                if (remaining >= Math.min(50, creep.store.getFreeCapacity(RESOURCE_ENERGY))) {
                    target.__gatherClaimed = claimed + creep.store.getFreeCapacity(RESOURCE_ENERGY);
                    creep.heap.targetId = target.id;
                    creep.heap.actionIntent = ActionConstants.ACTION_WITHDRAW;
                    return;
                }
            }

            // Fallback to hashed assignments if no scavenging targets are available
            const harvesters = roomState.creeps?.filter(c => c.my && c.memory.role === 'harvester') || [];
            if (harvesters.length > 0) {
                // Hashed assignment: Assign this hauler to a specific harvester based on the hauler's name string length
                const targetHarvester = harvesters[creep.name.length % harvesters.length];

                // Find dropped energy or container near this specific harvester
                const drops = roomState.droppedEnergy?.filter(d => d.pos.getRangeTo(targetHarvester) <= 2) || [];
                const containers = roomState.sourceContainers?.filter(c => c.pos.getRangeTo(targetHarvester) <= 2) || [];

                let targetDrop = null;
                let intent = '';

                if (drops.length > 0) {
                    targetDrop = drops[0];
                    intent = ActionConstants.ACTION_PICKUP;
                } else if (containers.length > 0 && containers[0].store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                    targetDrop = containers[0];
                    intent = ActionConstants.ACTION_WITHDRAW;
                }

                if (targetDrop) {
                    targetDrop.__gatherClaimed = (targetDrop.__gatherClaimed || 0) + creep.store.getFreeCapacity(RESOURCE_ENERGY);
                    creep.heap.targetId = targetDrop.id;
                    creep.heap.actionIntent = intent;
                    return;
                }
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
            if (roomState.controllerContainers?.length > 0) {
                const target = roomState.controllerContainers[0];
                const claimed = target.__deliveryClaimed || 0;
                const remainingSpace = target.store.getFreeCapacity(RESOURCE_ENERGY) - claimed;
                
                if (remainingSpace > 0) {
                    target.__deliveryClaimed = claimed + creep.store.getUsedCapacity(RESOURCE_ENERGY);
                    creep.heap.targetId = target.id;
                    creep.heap.actionIntent = ActionConstants.ACTION_TRANSFER;
                    return;
                }
            }

            creep.heap.targetId = roomState.controller.id;
            creep.heap.actionIntent = ActionConstants.ACTION_DROP;
        }
    }

    static assignUpgrader(creep, roomState) {
        if (roomState.controller) {
            creep.heap.targetId = roomState.controller.id;
            creep.heap.actionIntent = ActionConstants.ACTION_UPGRADE;

            if (!creep.heap.sitTargetId && roomState.controllerContainers?.length > 0) {
                creep.heap.sitTargetId = roomState.controllerContainers[0].id;
            }
        }
    }

    static assignBuilder(creep, roomState) {
        if (creep.heap.state === 'gather') {
            if (roomState.spawns?.length > 0 && roomState.spawns[0].store.getUsedCapacity(RESOURCE_ENERGY) > 100) {
                creep.heap.targetId = roomState.spawns[0].id;
                creep.heap.actionIntent = ActionConstants.ACTION_WITHDRAW;
                return;
            }
            
            if (roomState.droppedEnergy?.length > 0) {
                let maxDrop = roomState.droppedEnergy[0];
                for (let i = 1; i < roomState.droppedEnergy.length; i++) {
                    if (roomState.droppedEnergy[i].amount > maxDrop.amount) maxDrop = roomState.droppedEnergy[i];
                }
                creep.heap.targetId = maxDrop.id;
                creep.heap.actionIntent = ActionConstants.ACTION_PICKUP;
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
        if (roomState.repairTargets?.length > 0) {
            // Check: Replaced pos.findClosestByRange with O(1) global state array access to satisfy 'Zero Native Polling'.
            const target = roomState.repairTargets[0];
            if (target) {
                creep.heap.targetId = target.id;
                creep.heap.actionIntent = ActionConstants.ACTION_REPAIR;
                return;
            }
        }

        if (roomState.constructionSites?.length > 0) {
            const targetSite = roomState.constructionSites[0];
            if (targetSite) {
                creep.heap.targetId = targetSite.id;
                creep.heap.actionIntent = ActionConstants.ACTION_BUILD;
                return;
            }
        }

        if (roomState.controller) {
            creep.heap.targetId = roomState.controller.id;
            creep.heap.actionIntent = ActionConstants.ACTION_UPGRADE;
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
            creep.heap.targetId = bestTarget.id;
            creep.heap.actionIntent = ActionConstants.ACTION_TRANSFER;
            return true;
        }

        return false;
    }
}

module.exports = TaskAssignmentManager;