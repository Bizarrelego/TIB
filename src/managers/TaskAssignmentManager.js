
const ActionConstants = require('../constants/ActionConstants');
const CreepHeapUtility = require('../utilities/CreepHeapUtility');
const WithdrawTargetUtility = require('../utilities/WithdrawTargetUtility');
const GameObjectUtility = require('../utilities/GameObjectUtility');

/**
 * Hashes a string to a positive integer using djb2 algorithm.
 * Used to distribute creeps evenly across targets without collisions.
 * @param {string} str
 * @returns {number}
 */
function djb2Hash(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash) + str.charCodeAt(i);
        hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
}

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
            
            const roomName = creep.memory.room || creep.memory.colony || creep.room.name;
            const roomState = global.State?.rooms?.get(roomName);
            if (!roomState) continue;

            let heap = global.creepHeap.get(creep.name);
            if (!heap) {
                heap = CreepHeapUtility.getDefaultHeap();
                heap.secondaryTargetId = null;
                heap.sitTargetId = null;
                heap.sleepUntil = 0;
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

        if (creep.heap.state === 'gather') {
            target.__gatherClaimed = (target.__gatherClaimed || 0) + creep.store.getFreeCapacity();
        } else if (creep.heap.state === 'work' && (creep.heap.actionIntent === ActionConstants.ACTION_TRANSFER || creep.heap.actionIntent === ActionConstants.ACTION_BUILD)) {
            target.__deliveryClaimed = (target.__deliveryClaimed || 0) + creep.store.getUsedCapacity(RESOURCE_ENERGY);
        }
    }

    static updateCreepState(creep) {
        const role = creep.memory.role;

        // Harvesters don't use gather/work states — they just harvest forever
        if (role === 'harvester') return;
        // Upgraders don't use gather/work states — they upgrade and opportunistically pickup
        if (role === 'upgrader') return;

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

        // djb2 hash for even distribution across sources
        const source = sources[djb2Hash(creep.name) % sources.length];
        creep.heap.targetId = source.id;
        creep.heap.actionIntent = ActionConstants.ACTION_HARVEST;

        // Assign container-sit target if not already assigned
        if (!creep.heap.sitTargetId && roomState.sourceContainers?.length) {
            const container = roomState.sourceContainers.find(c => source.pos.inRangeTo(c, 2));
            if (container) creep.heap.sitTargetId = container.id;
        }
    }

    static assignHauler(creep, roomState) {
        if (creep.heap.state === 'gather') {
            // Priority 1: Scavenge from Ruins and Tombstones
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

            // Priority 2: Hashed assignment to specific harvester's drop zone
            const harvesters = roomState.creeps?.filter(c => c.my && c.memory.role === 'harvester') || [];
            if (harvesters.length > 0) {
                // djb2 hash for even distribution across harvesters
                const targetHarvester = harvesters[djb2Hash(creep.name) % harvesters.length];

                // Find dropped energy or container near this specific harvester
                // Pick highest-amount drop for efficiency
                const drops = roomState.droppedEnergy?.filter(d => d.pos.getRangeTo(targetHarvester) <= 2) || [];
                const containers = roomState.sourceContainers?.filter(c => c.pos.getRangeTo(targetHarvester) <= 2) || [];

                let bestTarget = null;
                let bestAmount = 0;
                let intent = '';

                for (let i = 0; i < drops.length; i++) {
                    const claimed = drops[i].__gatherClaimed || 0;
                    const available = drops[i].amount - claimed;
                    if (available > bestAmount) {
                        bestAmount = available;
                        bestTarget = drops[i];
                        intent = ActionConstants.ACTION_PICKUP;
                    }
                }

                for (let i = 0; i < containers.length; i++) {
                    const claimed = containers[i].__gatherClaimed || 0;
                    const available = containers[i].store.getUsedCapacity(RESOURCE_ENERGY) - claimed;
                    if (available > bestAmount) {
                        bestAmount = available;
                        bestTarget = containers[i];
                        intent = ActionConstants.ACTION_WITHDRAW;
                    }
                }

                if (bestTarget && bestAmount >= 50) {
                    bestTarget.__gatherClaimed = (bestTarget.__gatherClaimed || 0) + creep.store.getFreeCapacity(RESOURCE_ENERGY);
                    creep.heap.targetId = bestTarget.id;
                    creep.heap.actionIntent = intent;
                    return;
                }
            }

            // Priority 3: If hauler has partial energy, go deliver it instead of waiting
            if (creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                creep.heap.state = 'work';
                TaskAssignmentManager.assignHaulerWork(creep, roomState);
            }
            // If truly empty and no targets: do nothing this tick, will retry next tick
        } else {
            TaskAssignmentManager.assignHaulerWork(creep, roomState);
        }
    } 

    static assignHaulerWork(creep, roomState) {
        // Priority 1: Fill spawn/extensions
        if (TaskAssignmentManager.routeToStorage(creep, roomState)) return;

        // Priority 2: Fill controller container or drop at controller
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
            // Only withdraw from spawn when it has enough energy to still spawn a basic creep after
            if (roomState.spawns?.length > 0 && roomState.spawns[0].store.getUsedCapacity(RESOURCE_ENERGY) >= 250) {
                creep.heap.targetId = roomState.spawns[0].id;
                creep.heap.actionIntent = ActionConstants.ACTION_WITHDRAW;
                return;
            }
            
            // Try dropped energy — pick the largest pile
            if (roomState.droppedEnergy?.length > 0) {
                let maxDrop = roomState.droppedEnergy[0];
                for (let i = 1; i < roomState.droppedEnergy.length; i++) {
                    if (roomState.droppedEnergy[i].amount > maxDrop.amount) maxDrop = roomState.droppedEnergy[i];
                }
                creep.heap.targetId = maxDrop.id;
                creep.heap.actionIntent = ActionConstants.ACTION_PICKUP;
                return;
            }

            // Try source containers
            if (roomState.sourceContainers?.length > 0) {
                for (let i = 0; i < roomState.sourceContainers.length; i++) {
                    const container = roomState.sourceContainers[i];
                    if (container.store.getUsedCapacity(RESOURCE_ENERGY) >= 50) {
                        creep.heap.targetId = container.id;
                        creep.heap.actionIntent = ActionConstants.ACTION_WITHDRAW;
                        return;
                    }
                }
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
        // Priority 1: Repair damaged structures
        if (roomState.repairTargets?.length > 0) {
            // Pick closest repair target using Chebyshev distance
            let bestTarget = roomState.repairTargets[0];
            let bestDist = Infinity;
            for (let i = 0; i < roomState.repairTargets.length; i++) {
                const t = roomState.repairTargets[i];
                const dx = Math.abs(creep.pos.x - t.pos.x);
                const dy = Math.abs(creep.pos.y - t.pos.y);
                const dist = Math.max(dx, dy);
                if (dist < bestDist) {
                    bestDist = dist;
                    bestTarget = t;
                }
            }
            creep.heap.targetId = bestTarget.id;
            creep.heap.actionIntent = ActionConstants.ACTION_REPAIR;
            return;
        }

        // Priority 2: Build construction sites
        if (roomState.constructionSites?.length > 0) {
            // Pick closest construction site
            let bestSite = roomState.constructionSites[0];
            let bestDist = Infinity;
            for (let i = 0; i < roomState.constructionSites.length; i++) {
                const s = roomState.constructionSites[i];
                const dx = Math.abs(creep.pos.x - s.pos.x);
                const dy = Math.abs(creep.pos.y - s.pos.y);
                const dist = Math.max(dx, dy);
                if (dist < bestDist) {
                    bestDist = dist;
                    bestSite = s;
                }
            }
            creep.heap.targetId = bestSite.id;
            creep.heap.actionIntent = ActionConstants.ACTION_BUILD;
            return;
        }

        // Fallback: Upgrade controller
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
            // Weight by remaining space so haulers prefer emptier targets
            const score = remainingSpace * 100 / distance; 
            
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