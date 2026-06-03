const RepairTargetUtility = require('../utilities/RepairTargetUtility');

/**
 * Top-Down, Heap-Driven Task Assignment Manager
 * Enforces strict Drop-Mining, Stationary Upgrading, and Distance-Weighted Hauling
 */
class TaskAssignmentManager {
    static run() {
        if (!(global.creepHeap instanceof Map)) global.creepHeap = new Map();
        if (!global.Tick) global.Tick = {};
        
        // Separate claims for gathering (pulling energy) and delivering (pushing energy)
        global.Tick.gatherClaims = new Map();
        global.Tick.deliveryClaims = new Map();

        const creepNames = Object.keys(Game.creeps);
        
        for (let i = 0; i < creepNames.length; i++) {
            const creep = Game.creeps[creepNames[i]];
            
            const roomObj = Game.rooms[creep.memory.room || creep.room.name];
            if (!roomObj) continue;

            const roomState = global.State?.rooms?.get(roomObj.name);
            if (!roomState) continue; // Abort if GlobalStateScanner has not processed the room

            if (!global.creepHeap.has(creep.name)) {
                global.creepHeap.set(creep.name, { state: 'idle', actionIntent: 'idle', targetId: null, secondaryTargetId: null });
            }
            creep.heap = global.creepHeap.get(creep.name);

            if (creep.heap.actionIntent !== 'idle' && creep.heap.actionIntent !== null) {
                TaskAssignmentManager.validateCurrentTask(creep, roomState);
                
                // If task remains valid after check, re-register claims and skip reassignment
                if (creep.heap.actionIntent !== 'idle') {
                    if (creep.heap.actionIntent === 'upgrade') {
                        const drop = roomState.droppedEnergy ? roomState.droppedEnergy.find(d => d.pos.inRangeTo(creep.pos, 3)) : null;
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
        if (creep.heap.state === 'gather') {
            global.Tick.gatherClaims.set(creep.heap.targetId, (global.Tick.gatherClaims.get(creep.heap.targetId) || 0) + creep.store.getFreeCapacity());
        } else if (creep.heap.state === 'work' && (creep.heap.actionIntent === 'transfer' || creep.heap.actionIntent === 'build')) {
            global.Tick.deliveryClaims.set(creep.heap.targetId, (global.Tick.deliveryClaims.get(creep.heap.targetId) || 0) + creep.store.getUsedCapacity(RESOURCE_ENERGY));
        }
    }

    static updateCreepState(creep) {
        const used = creep.store.getUsedCapacity(RESOURCE_ENERGY);
        const free = creep.store.getFreeCapacity(RESOURCE_ENERGY);

        if (!creep.heap.state || creep.heap.state === 'idle') {
            creep.heap.state = 'gather';
        }

        if (creep.heap.state === 'gather' && free === 0) {
            creep.heap.state = 'work';
            creep.heap.targetId = null; 
        } else if (creep.heap.state === 'work' && used === 0) {
            creep.heap.state = 'gather';
            creep.heap.targetId = null; 
        }
    }

    static validateCurrentTask(creep, roomState) {
        if (!creep.heap.targetId) return;
        const target = Game.getObjectById(creep.heap.targetId);
        
        if (!target) {
            creep.heap.targetId = null;
            creep.heap.actionIntent = 'idle';
            return;
        }

        // Invalidate gather targets that are empty
        if (creep.heap.state === 'gather') {
            if ((target.amount !== undefined && target.amount < 50) || 
                (target.store && target.store.getUsedCapacity(RESOURCE_ENERGY) < 50)) {
                creep.heap.targetId = null;
                creep.heap.actionIntent = 'idle';
            }
        } 
        // Invalidate work targets
        else if (creep.heap.state === 'work') {
            // If creep emptied its inventory, task is done
            if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
                creep.heap.targetId = null;
                creep.heap.actionIntent = 'idle';
            }
            // If target filled up, task is invalid
            else if (target.store && target.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
                creep.heap.targetId = null;
                creep.heap.actionIntent = 'idle';
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

        let hash = 0;
        for (let i = 0; i < creep.name.length; i++) hash += creep.name.charCodeAt(i);
        
        const source = sources[hash % sources.length];
        creep.heap.targetId = source.id;
        creep.heap.actionIntent = 'harvest';

        if (!creep.heap.sitTargetId && roomState.sourceContainers) {
            const containers = roomState.sourceContainers.filter(c => c.pos.inRangeTo(source, 2));
            if (containers.length > 0) creep.heap.sitTargetId = containers[0].id;
        }
    }

    static assignHauler(creep, roomState) {
        if (creep.heap.state === 'gather') {
            
            let bestTarget = null;
            let bestScore = -1;
            let intent = '';

            const evaluateTarget = (target, amount, actionIntent) => {
                const claimed = global.Tick.gatherClaims.get(target.id) || 0;
                const remaining = amount - claimed;
                
                if (remaining >= Math.min(50, creep.store.getFreeCapacity(RESOURCE_ENERGY))) {
                    const distance = creep.pos.getRangeTo(target) || 1;
                    const score = remaining / distance;
                    
                    if (score > bestScore) {
                        bestScore = score;
                        bestTarget = target;
                        intent = actionIntent;
                    }
                }
            };

            if (roomState.tombstones) {
                for (let i = 0; i < roomState.tombstones.length; i++) {
                    evaluateTarget(roomState.tombstones[i], roomState.tombstones[i].store.getUsedCapacity(RESOURCE_ENERGY), 'withdraw');
                }
            }
            if (roomState.ruins) {
                for (let i = 0; i < roomState.ruins.length; i++) {
                    evaluateTarget(roomState.ruins[i], roomState.ruins[i].store.getUsedCapacity(RESOURCE_ENERGY), 'withdraw');
                }
            }
            if (roomState.sourceContainers) {
                for (let i = 0; i < roomState.sourceContainers.length; i++) {
                    evaluateTarget(roomState.sourceContainers[i], roomState.sourceContainers[i].store.getUsedCapacity(RESOURCE_ENERGY), 'withdraw');
                }
            }
            if (roomState.droppedEnergy) {
                for (let i = 0; i < roomState.droppedEnergy.length; i++) {
                    evaluateTarget(roomState.droppedEnergy[i], roomState.droppedEnergy[i].amount, 'pickup');
                }
            }

            if (bestTarget) {
                global.Tick.gatherClaims.set(bestTarget.id, (global.Tick.gatherClaims.get(bestTarget.id) || 0) + creep.store.getFreeCapacity(RESOURCE_ENERGY));
                creep.heap.targetId = bestTarget.id;
                creep.heap.actionIntent = intent;
                return;
            }

            // Force transition to work state if no energy exists to gather but we are partially full
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
            if (roomState.controllerContainers && roomState.controllerContainers.length > 0) {
                const target = roomState.controllerContainers[0];
                const claimed = global.Tick.deliveryClaims.get(target.id) || 0;
                const remainingSpace = target.store.getFreeCapacity(RESOURCE_ENERGY) - claimed;
                
                if (remainingSpace > 0) {
                    global.Tick.deliveryClaims.set(target.id, claimed + creep.store.getUsedCapacity(RESOURCE_ENERGY));
                    creep.heap.targetId = target.id;
                    creep.heap.actionIntent = 'transfer';
                    return;
                }
            }

            creep.heap.targetId = roomState.controller.id;
            creep.heap.actionIntent = 'drop';
        }
    }

    static assignUpgrader(creep, roomState) {
        if (roomState.controller) {
            creep.heap.targetId = roomState.controller.id;
            creep.heap.actionIntent = 'upgrade';

            if (!creep.heap.sitTargetId && roomState.controllerContainers) {
                if (roomState.controllerContainers.length > 0) {
                    creep.heap.sitTargetId = roomState.controllerContainers[0].id;
                }
            }
        }
    }

    static assignBuilder(creep, roomState) {
        if (creep.heap.state === 'gather') {
            if (roomState.spawns && roomState.spawns.length > 0 && roomState.spawns[0].store.getUsedCapacity(RESOURCE_ENERGY) > 100) {
                creep.heap.targetId = roomState.spawns[0].id;
                creep.heap.actionIntent = 'withdraw';
                return;
            }
            
            if (roomState.droppedEnergy && roomState.droppedEnergy.length > 0) {
                let maxDrop = roomState.droppedEnergy[0];
                for (let i = 1; i < roomState.droppedEnergy.length; i++) {
                    if (roomState.droppedEnergy[i].amount > maxDrop.amount) maxDrop = roomState.droppedEnergy[i];
                }
                creep.heap.targetId = maxDrop.id;
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
        const repairTargets = roomState.repairTargets;
        if (repairTargets && repairTargets.length > 0) {
            let closest = null;
            let minRange = Infinity;

            for (let i = 0; i < repairTargets.length; i++) {
                const target = repairTargets[i];
                const range = creep.pos.getRangeTo(target);
                if (range < minRange) {
                    minRange = range;
                    closest = target;
                }
            }

            if (closest) {
                creep.heap.targetId = closest.id;
                creep.heap.actionIntent = 'repair';
                return;
            }
        }

        const sites = roomState.constructionSites;
        if (sites && sites.length > 0) {
            let closestSite = null;
            let minRangeSite = Infinity;

            for (let i = 0; i < sites.length; i++) {
                const site = sites[i];
                const range = creep.pos.getRangeTo(site);
                if (range < minRangeSite) {
                    minRangeSite = range;
                    closestSite = site;
                }
            }

            if (closestSite) {
                creep.heap.targetId = closestSite.id;
                creep.heap.actionIntent = 'build';
                return;
            }
        }

        if (roomState.controller) {
            creep.heap.targetId = roomState.controller.id;
            creep.heap.actionIntent = 'upgrade';
        }
    }

    static routeToStorage(creep, roomState) {
        let bestTarget = null;
        let bestScore = -1;

        const evaluateTarget = (target) => {
            const freeCapacity = target.store.getFreeCapacity(RESOURCE_ENERGY);
            if (freeCapacity === 0) return;

            const claimed = global.Tick.deliveryClaims.get(target.id) || 0;
            const remainingSpace = freeCapacity - claimed;
            if (remainingSpace <= 0) return;

            const distance = creep.pos.getRangeTo(target) || 1;
            const score = 1000 / distance; 
            
            if (score > bestScore) {
                bestScore = score;
                bestTarget = target;
            }
        };

        if (roomState.spawns) {
            for (let i = 0; i < roomState.spawns.length; i++) evaluateTarget(roomState.spawns[i]);
        }
        if (roomState.extensions) {
            for (let i = 0; i < roomState.extensions.length; i++) evaluateTarget(roomState.extensions[i]);
        }

        if (bestTarget) {
            global.Tick.deliveryClaims.set(bestTarget.id, (global.Tick.deliveryClaims.get(bestTarget.id) || 0) + creep.store.getUsedCapacity(RESOURCE_ENERGY));
            creep.heap.targetId = bestTarget.id;
            creep.heap.actionIntent = 'transfer';
            return true;
        }

        return false;
    }
}

module.exports = TaskAssignmentManager;