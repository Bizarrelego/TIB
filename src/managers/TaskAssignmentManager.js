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
            if (creep.spawning) continue;

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

            if (Game.time < creep.heap.sleepUntil) continue;

            if (creep.heap.actionIntent !== ActionConstants.ACTION_IDLE && creep.heap.actionIntent !== null) {
                TaskAssignmentManager.validateCurrentTask(creep);

                if (creep.heap.actionIntent !== ActionConstants.ACTION_IDLE) {
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

        // Harvesters and Upgraders are stationary roles and do not use gather/work cycles
        if (role === 'harvester' || role === 'upgrader') return;

        const used = creep.store.getUsedCapacity(RESOURCE_ENERGY);
        const free = creep.store.getFreeCapacity(RESOURCE_ENERGY);

        if (!creep.heap.state || creep.heap.state === 'idle') creep.heap.state = 'gather';

        if (creep.heap.state === 'gather' && free === 0) {
            creep.heap.state = 'work';
            creep.heap.targetId = null;
            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
        } else if (creep.heap.state === 'work' && used === 0) {
            creep.heap.state = 'gather';
            creep.heap.targetId = null;
            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
        }
    }

    static validateCurrentTask(creep) {
        if (!creep.heap.targetId) {
            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
            return;
        }
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
        const role = (creep.memory.role || '').toLowerCase();
        if (role === 'harvester') TaskAssignmentManager.assignHarvester(creep, roomState);
        else if (role === 'hauler') TaskAssignmentManager.assignHauler(creep, roomState);
        else if (role === 'builder') TaskAssignmentManager.assignBuilder(creep, roomState);
        else if (role === 'bootstrapper') TaskAssignmentManager.assignBootstrapper(creep, roomState);
        else if (role === 'upgrader') TaskAssignmentManager.assignUpgrader(creep, roomState);
        else if (role === 'filler') TaskAssignmentManager.assignFiller(creep, roomState);
        else if (role === 'remoteharvester') TaskAssignmentManager.assignRemoteHarvester(creep, roomState);
        else if (role === 'remotehauler') TaskAssignmentManager.assignRemoteHauler(creep, roomState);
    }

    static assignRemoteHarvester(creep, homeState) {
        if (!creep.memory.targetRoom) {
            const outposts = Memory.rooms[creep.memory.colony]?.outposts || [];
            if (outposts.length > 0) {
                creep.memory.targetRoom = outposts[djb2Hash(creep.name) % outposts.length];
            } else {
                return;
            }
        }

        if (creep.room.name !== creep.memory.targetRoom) {
            creep.heap.actionIntent = ActionConstants.ACTION_MOVE_ROOM;
            return;
        }

        const roomState = global.State?.rooms?.get(creep.room.name);
        if (!roomState) return;

        TaskAssignmentManager.assignHarvester(creep, roomState);
    }

    static assignRemoteHauler(creep, homeState) {
        if (creep.heap.state === 'gather') {
            if (!creep.memory.targetRoom) {
                const outposts = Memory.rooms[creep.memory.colony]?.outposts || [];
                if (outposts.length > 0) {
                    creep.memory.targetRoom = outposts[djb2Hash(creep.name) % outposts.length];
                } else {
                    return;
                }
            }
            if (creep.room.name !== creep.memory.targetRoom) {
                creep.heap.actionIntent = ActionConstants.ACTION_MOVE_ROOM;
                return;
            }
            const roomState = global.State?.rooms?.get(creep.room.name);
            if (!roomState) return;

            let bestTarget = null;
            let bestAmount = 0;
            const drops = roomState.droppedEnergy || [];
            for (let i = 0; i < drops.length; i++) {
                const d = drops[i];
                const claimed = d.__gatherClaimed || 0;
                const available = d.amount - claimed;
                if (available > bestAmount) {
                    bestAmount = available;
                    bestTarget = d;
                }
            }

            if (bestTarget && bestAmount >= 25) {
                bestTarget.__gatherClaimed = (bestTarget.__gatherClaimed || 0) + creep.store.getFreeCapacity(RESOURCE_ENERGY);
                creep.heap.targetId = bestTarget.id;
                creep.heap.actionIntent = ActionConstants.ACTION_PICKUP;
            } else {
                creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
            }
            
            if (creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0 && !bestTarget) {
                creep.heap.state = 'work';
                creep.heap.targetId = null;
                creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
            }

        } else {
            if (creep.room.name !== creep.memory.colony) {
                creep.memory.targetRoom = creep.memory.colony;
                creep.heap.actionIntent = ActionConstants.ACTION_MOVE_ROOM;
                return;
            }
            TaskAssignmentManager.assignHaulerWork(creep, homeState);
        }
    }

    static assignFiller(creep, roomState) {
        if (creep.heap.state === 'gather') {
            // Filler only pulls from Storage
            if (roomState.storage && roomState.storage.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                creep.heap.targetId = roomState.storage.id;
                creep.heap.actionIntent = ActionConstants.ACTION_WITHDRAW;
            } else {
                // If no storage (or empty), filler sleeps or idles
                creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
            }
        } else {
            // Priority: Fill spawns, extensions, towers
            if (TaskAssignmentManager.routeToCoreStructures(creep, roomState)) return;
            // No core structures need energy? Idle.
            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
        }
    }

    static assignHarvester(creep, roomState) {
        const sources = roomState.sources;
        if (!sources || sources.length === 0) return;

        // Balance assignment dynamically based on current heap assignments
        const counts = new Map();
        if (roomState.harvesters) {
            for (let i = 0; i < roomState.harvesters.length; i++) {
                const h = roomState.harvesters[i];
                if (h.heap && h.heap.targetId) {
                    counts.set(h.heap.targetId, (counts.get(h.heap.targetId) || 0) + 1);
                }
            }
        }

        let bestSource = sources[0];
        let minCount = Infinity;

        for (let i = 0; i < sources.length; i++) {
            const count = counts.get(sources[i].id) || 0;
            if (count < minCount) {
                minCount = count;
                bestSource = sources[i];
            }
        }

        creep.heap.targetId = bestSource.id;
        creep.heap.actionIntent = ActionConstants.ACTION_HARVEST;

        // Assign sitTargetId if a container exists for this source
        if (roomState.sourceContainers) {
            for (let i = 0; i < roomState.sourceContainers.length; i++) {
                const c = roomState.sourceContainers[i];
                if (c.pos.getRangeTo(bestSource) <= 2) {
                    creep.heap.sitTargetId = c.id;
                    break;
                }
            }
        }
    }

    static assignHauler(creep, roomState) {
        if (creep.heap.state === 'gather') {
            // Priority 1: Scavenge from Ruins and Tombstones
            const scavengeTargets = WithdrawTargetUtility.getScavengeTargets(roomState);
            let bestScavenge = null;
            let bestScavengeScore = -1;

            for (let i = 0; i < scavengeTargets.length; i++) {
                const target = scavengeTargets[i];
                const amount = target.store.getUsedCapacity(RESOURCE_ENERGY);
                const claimed = target.__gatherClaimed || 0;
                const remaining = amount - claimed;

                if (remaining >= Math.min(25, creep.store.getFreeCapacity(RESOURCE_ENERGY))) {
                    const dist = Math.max(Math.abs(creep.pos.x - target.pos.x), Math.abs(creep.pos.y - target.pos.y)) || 1;
                    const score = remaining / dist;
                    if (score > bestScavengeScore) {
                        bestScavengeScore = score;
                        bestScavenge = target;
                    }
                }
            }

            if (bestScavenge) {
                bestScavenge.__gatherClaimed = (bestScavenge.__gatherClaimed || 0) + creep.store.getFreeCapacity(RESOURCE_ENERGY);
                creep.heap.targetId = bestScavenge.id;
                creep.heap.actionIntent = ActionConstants.ACTION_WITHDRAW;
                return;
            }

            // Priority 1.5: Withdraw from Containers (if they exist and have energy)
            if (roomState.containers) {
                let bestContainer = null;
                let bestContainerScore = -1;
                for (let i = 0; i < roomState.containers.length; i++) {
                    const c = roomState.containers[i];
                    // Skip if this is the controller's container (we only pull from source containers)
                    if (roomState.controller && c.pos.getRangeTo(roomState.controller) <= 3) continue;

                    const amount = c.store.getUsedCapacity(RESOURCE_ENERGY);
                    const claimed = c.__gatherClaimed || 0;
                    const remaining = amount - claimed;

                    if (remaining >= Math.min(25, creep.store.getFreeCapacity(RESOURCE_ENERGY))) {
                        const dist = Math.max(Math.abs(creep.pos.x - c.pos.x), Math.abs(creep.pos.y - c.pos.y)) || 1;
                        const score = remaining / dist;
                        if (score > bestContainerScore) {
                            bestContainerScore = score;
                            bestContainer = c;
                        }
                    }
                }
                if (bestContainer) {
                    bestContainer.__gatherClaimed = (bestContainer.__gatherClaimed || 0) + creep.store.getFreeCapacity(RESOURCE_ENERGY);
                    creep.heap.targetId = bestContainer.id;
                    creep.heap.actionIntent = ActionConstants.ACTION_WITHDRAW;
                    return;
                }
            }

            // Priority 2: Hashed assignment to specific harvester's drop zone
            const harvesters = roomState.harvesters || [];
            if (harvesters.length > 0) {
                // djb2 hash for even distribution across harvesters
                const targetHarvester = harvesters[djb2Hash(creep.name) % harvesters.length];

                // Find dropped energy near this specific harvester using fast Chebyshev distance
                // Pick highest-amount drop for efficiency
                let bestTarget = null;
                let bestAmount = 0;
                let intent = '';
                const drops = roomState.droppedEnergy || [];

                for (let i = 0; i < drops.length; i++) {
                    const d = drops[i];
                    if (Math.max(Math.abs(d.pos.x - targetHarvester.pos.x), Math.abs(d.pos.y - targetHarvester.pos.y)) <= 2) {
                        const claimed = d.__gatherClaimed || 0;
                        const available = d.amount - claimed;
                        if (available > bestAmount) {
                            bestAmount = available;
                            bestTarget = d;
                            intent = ActionConstants.ACTION_PICKUP;
                        }
                    }
                }

                if (bestTarget && bestAmount >= 25) {
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
        // Priority 1: Dump in Storage if it exists
        if (roomState.storage && roomState.storage.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
            creep.heap.targetId = roomState.storage.id;
            creep.heap.actionIntent = ActionConstants.ACTION_TRANSFER;
            return;
        }

        // Priority 2: Fill spawn/extensions (Pre-Storage behavior)
        if (TaskAssignmentManager.routeToCoreStructures(creep, roomState)) return;

        // Priority 2: Drop/Transfer at controller
        if (roomState.controller) {
            // Check if controller has a container
            let controllerContainer = null;
            if (roomState.containers) {
                for (let i = 0; i < roomState.containers.length; i++) {
                    const c = roomState.containers[i];
                    if (c.pos.getRangeTo(roomState.controller) <= 3) {
                        controllerContainer = c;
                        break;
                    }
                }
            }

            if (controllerContainer) {
                creep.heap.targetId = controllerContainer.id;
                creep.heap.actionIntent = ActionConstants.ACTION_TRANSFER;
            } else {
                creep.heap.targetId = roomState.controller.id;
                creep.heap.actionIntent = ActionConstants.ACTION_DROP;
            }
        }
    }

    static assignBuilder(creep, roomState) {
        if (creep.heap.state === 'gather') {
            // Distance-aware energy source selection
            const bestSource = TaskAssignmentManager.findClosestEnergy(creep, roomState);
            if (bestSource) {
                creep.heap.targetId = bestSource.id;
                creep.heap.actionIntent = bestSource.actionIntent;
                return;
            }

            // Nothing to gather but have some energy — go work
            if (creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                creep.heap.state = 'work';
                TaskAssignmentManager.assignBuilderWork(creep, roomState);
            }
        } else {
            TaskAssignmentManager.assignBuilderWork(creep, roomState);
        }
    }

    static assignBuilderWork(creep, roomState) {
        // Priority 1: Build construction sites — prefer nearly-complete ones
        if (roomState.constructionSites?.length > 0) {
            let bestSite = null;
            let bestScore = -1;
            for (let i = 0; i < roomState.constructionSites.length; i++) {
                const s = roomState.constructionSites[i];
                const dx = Math.abs(creep.pos.x - s.pos.x);
                const dy = Math.abs(creep.pos.y - s.pos.y);
                const dist = Math.max(dx, dy) || 1;
                // Progress ratio: higher = closer to completion
                const progress = s.progressTotal > 0 ? s.progress / s.progressTotal : 0;
                // Score: prefer nearby + nearly-complete sites
                const score = (1 + progress * 3) * 100 / dist;
                if (score > bestScore) {
                    bestScore = score;
                    bestSite = s;
                }
            }
            if (bestSite) {
                creep.heap.targetId = bestSite.id;
                creep.heap.actionIntent = ActionConstants.ACTION_BUILD;
                return;
            }
        }

        // Priority 2: Repair critically damaged structures (< 50% health only)
        if (roomState.repairTargets?.length > 0) {
            let bestTarget = null;
            let bestDist = Infinity;
            for (let i = 0; i < roomState.repairTargets.length; i++) {
                const t = roomState.repairTargets[i];
                // Only repair critically damaged structures
                if (t.hits >= t.hitsMax * 0.5) continue;
                const dx = Math.abs(creep.pos.x - t.pos.x);
                const dy = Math.abs(creep.pos.y - t.pos.y);
                const dist = Math.max(dx, dy);
                if (dist < bestDist) {
                    bestDist = dist;
                    bestTarget = t;
                }
            }
            if (bestTarget) {
                creep.heap.targetId = bestTarget.id;
                creep.heap.actionIntent = ActionConstants.ACTION_REPAIR;
                return;
            }
        }

        // Fallback: Upgrade controller
        if (roomState.controller) {
            creep.heap.targetId = roomState.controller.id;
            creep.heap.actionIntent = ActionConstants.ACTION_UPGRADE;
        }
    }

    static routeToCoreStructures(creep, roomState) {
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
        roomState.towers?.forEach(t => {
            // Only fill towers if they are missing > 200 energy
            if (t.store.getFreeCapacity(RESOURCE_ENERGY) >= 200) evaluateTarget(t);
        });

        if (bestTarget) {
            bestTarget.__deliveryClaimed = (bestTarget.__deliveryClaimed || 0) + creep.store.getUsedCapacity(RESOURCE_ENERGY);
            creep.heap.targetId = bestTarget.id;
            creep.heap.actionIntent = ActionConstants.ACTION_TRANSFER;
            return true;
        }

        return false;
    }

    static findClosestEnergy(creep, roomState) {
        let bestTarget = null;
        let bestDist = Infinity;
        let bestIntent = null;

        // Check dropped energy
        if (roomState.droppedEnergy) {
            for (let i = 0; i < roomState.droppedEnergy.length; i++) {
                const drop = roomState.droppedEnergy[i];
                if (drop.amount < 30) continue;
                const claimed = drop.__gatherClaimed || 0;
                if (drop.amount - claimed < 30) continue;
                const dx = Math.abs(creep.pos.x - drop.pos.x);
                const dy = Math.abs(creep.pos.y - drop.pos.y);
                const dist = Math.max(dx, dy);
                if (dist < bestDist) {
                    bestDist = dist;
                    bestTarget = drop;
                    bestIntent = ActionConstants.ACTION_PICKUP;
                }
            }
        }

        // Check spawn — only if spawn has enough to not starve spawning (300+)
        if (roomState.spawns) {
            for (let i = 0; i < roomState.spawns.length; i++) {
                const spawn = roomState.spawns[i];
                if (spawn.store.getUsedCapacity(RESOURCE_ENERGY) < 300) continue;
                const dx = Math.abs(creep.pos.x - spawn.pos.x);
                const dy = Math.abs(creep.pos.y - spawn.pos.y);
                const dist = Math.max(dx, dy);
                if (dist < bestDist) {
                    bestDist = dist;
                    bestTarget = spawn;
                    bestIntent = ActionConstants.ACTION_WITHDRAW;
                }
            }
        }

        if (bestTarget) {
            bestTarget.__gatherClaimed = (bestTarget.__gatherClaimed || 0) + creep.store.getFreeCapacity(RESOURCE_ENERGY);
            return { id: bestTarget.id, actionIntent: bestIntent };
        }
        return null;
    }

    static assignBootstrapper(creep, roomState) {
        if (creep.heap.state === 'gather') {
            // First try to scavenge dropped energy like a builder
            const bestSource = TaskAssignmentManager.findClosestEnergy(creep, roomState);
            if (bestSource) {
                creep.heap.targetId = bestSource.id;
                creep.heap.actionIntent = bestSource.actionIntent;
                return;
            }

            // Fallback: Harvest directly from the nearest source
            if (roomState.sources && roomState.sources.length > 0) {
                let bestTarget = null;
                let bestDist = Infinity;
                for (let i = 0; i < roomState.sources.length; i++) {
                    const source = roomState.sources[i];
                    const dx = Math.abs(creep.pos.x - source.pos.x);
                    const dy = Math.abs(creep.pos.y - source.pos.y);
                    const dist = Math.max(dx, dy);
                    if (dist < bestDist) {
                        bestDist = dist;
                        bestTarget = source;
                    }
                }
                if (bestTarget) {
                    creep.heap.targetId = bestTarget.id;
                    creep.heap.actionIntent = ActionConstants.ACTION_HARVEST;
                }
            }
        } else {
            // Work phase: Fill Spawns/Extensions first to get real creeps spawning
            if (TaskAssignmentManager.routeToCoreStructures(creep, roomState)) return;

            // Priority 2: Build critical structures (like containers)
            if (roomState.constructionSites && roomState.constructionSites.length > 0) {
                let bestSite = null;
                let bestScore = -1;
                for (let i = 0; i < roomState.constructionSites.length; i++) {
                    const s = roomState.constructionSites[i];
                    const dist = Math.max(Math.abs(creep.pos.x - s.pos.x), Math.abs(creep.pos.y - s.pos.y)) || 1;
                    const score = 100 / dist;
                    if (score > bestScore) {
                        bestScore = score;
                        bestSite = s;
                    }
                }
                if (bestSite) {
                    creep.heap.targetId = bestSite.id;
                    creep.heap.actionIntent = ActionConstants.ACTION_BUILD;
                    return;
                }
            }

            // Fallback: Upgrade controller
            if (roomState.controller) {
                creep.heap.targetId = roomState.controller.id;
                creep.heap.actionIntent = ActionConstants.ACTION_UPGRADE;
            }
        }
    }

    static assignUpgrader(creep, roomState) {
        if (!roomState.controller) return;
        creep.heap.targetId = roomState.controller.id;
        creep.heap.actionIntent = ActionConstants.ACTION_UPGRADE;
    }
}

module.exports = TaskAssignmentManager;