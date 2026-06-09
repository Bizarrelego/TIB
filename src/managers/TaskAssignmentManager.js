const ActionConstants = require('../constants/ActionConstants');
const CacheLib = require('../lib/CacheLib');
const MathLib = require('../lib/MathLib');



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
                heap = CacheLib.getDefaultHeap();
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
        const target = CacheLib.getById(creep.heap.targetId);
        if (!target) return;

        if (creep.heap.state === 'gather') {
            target.__gatherClaimed = (target.__gatherClaimed || 0) + creep.store.getFreeCapacity();
        } else if (creep.heap.state === 'work' && (creep.heap.actionIntent === ActionConstants.ACTION_TRANSFER || creep.heap.actionIntent === ActionConstants.ACTION_BUILD)) {
            target.__deliveryClaimed = (target.__deliveryClaimed || 0) + creep.store.getUsedCapacity(RESOURCE_ENERGY);
        }
    }

    static updateCreepState(creep) {
        const role = creep.memory.role || '';

        // Harvesters and Upgraders are stationary roles and do not use gather/work cycles
        if (role === 'harvester' || role === 'upgrader' || role === 'remoteharvester') return;

        const totalUsed = creep.store.getUsedCapacity();
        const free = creep.store.getFreeCapacity(RESOURCE_ENERGY);

        if (!creep.heap.state || creep.heap.state === 'idle') {
            // Force haulers/fillers to completely empty before gathering again
            if ((role === 'hauler' || role === 'filler' || role === 'remotehauler') && totalUsed > 0) {
                creep.heap.state = 'work';
            } else {
                creep.heap.state = 'gather';
            }
        }

        if (creep.heap.state === 'gather' && free === 0) {
            creep.heap.state = 'work';
            creep.heap.targetId = null;
            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
        } else if (creep.heap.state === 'work' && totalUsed === 0) {
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
        const target = CacheLib.getById(creep.heap.targetId);

        if (!target) {
            creep.heap.targetId = null;
            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
            return;
        }

        if (creep.heap.state === 'gather') {
            if ((target.amount !== undefined && target.amount < 50) ||
                (target.store && target.store.getUsedCapacity() < 50)) {
                creep.heap.targetId = null;
                creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
            }
        } else if (creep.heap.state === 'work') {
            if (creep.store.getUsedCapacity() === 0 ||
                (target.store && target.store.getFreeCapacity() === 0)) {
                creep.heap.targetId = null;
                creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
            }
        }
    }

    static assignTask(creep, roomState) {
        const role = (creep.memory.role || '').toLowerCase();
        // Military creeps are managed exclusively by MilitaryManager — skip to prevent heap overwrite
        if (role === 'meleecreep' || role === 'rangercreep' || role === 'mediccreep') return;
        if (role === 'harvester') TaskAssignmentManager.assignHarvester(creep, roomState);
        else if (role === 'hauler') TaskAssignmentManager.assignHauler(creep, roomState);
        else if (role === 'builder') TaskAssignmentManager.assignBuilder(creep, roomState);
        else if (role === 'bootstrapper') TaskAssignmentManager.assignBootstrapper(creep, roomState);
        else if (role === 'upgrader') TaskAssignmentManager.assignUpgrader(creep, roomState);
        else if (role === 'filler') TaskAssignmentManager.assignFiller(creep, roomState);
        else if (role === 'remoteharvester') TaskAssignmentManager.assignRemoteHarvester(creep, roomState);
        else if (role === 'remotehauler') TaskAssignmentManager.assignRemoteHauler(creep, roomState);
        else if (role === 'repairman') TaskAssignmentManager.assignRepairman(creep, roomState);
        else if (role === 'defender') TaskAssignmentManager.assignDefender(creep, roomState);
        else if (role === 'hubcreep') TaskAssignmentManager.assignHubCreep(creep, roomState);
    }

    static assignHubCreep(creep, roomState) {
        // Find the Hub Link (close to storage)
        let hubLink = null;
        if (roomState.links && roomState.storage) {
            for (let i = 0; i < roomState.links.length; i++) {
                if (roomState.links[i].pos.inRangeTo(roomState.storage, 2)) {
                    hubLink = roomState.links[i];
                    break;
                }
            }
        }

        const terminal = roomState.terminal;
        const storage = roomState.storage;

        if (!storage) {
            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
            return;
        }

        if (creep.heap.state === 'gather') {
            // Priority 1: Empty Hub Link
            if (hubLink && hubLink.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                creep.heap.targetId = hubLink.id;
                creep.heap.actionIntent = ActionConstants.ACTION_WITHDRAW;
                return;
            }

            // Priority 2: Terminal overflow -> Storage
            if (terminal && terminal.store.getUsedCapacity(RESOURCE_ENERGY) > 100000) {
                creep.heap.targetId = terminal.id;
                creep.heap.actionIntent = ActionConstants.ACTION_WITHDRAW;
                return;
            }

            // Priority 3: Storage -> Terminal if storage is overflowing (> 500k)
            if (terminal && storage.store.getUsedCapacity(RESOURCE_ENERGY) > 500000 && terminal.store.getFreeCapacity() > 0) {
                creep.heap.targetId = storage.id;
                creep.heap.actionIntent = ActionConstants.ACTION_WITHDRAW;
                return;
            }

            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
        } else {
            // Work phase (we are holding energy)
            
            // Priority 1: Fill Terminal if we withdrew from Storage due to overflow
            if (terminal && storage.store.getUsedCapacity(RESOURCE_ENERGY) > 500000 && terminal.store.getFreeCapacity() > 0) {
                creep.heap.targetId = terminal.id;
                creep.heap.actionIntent = ActionConstants.ACTION_TRANSFER;
                return;
            }

            // Priority 2: Dump everything else into Storage
            if (storage.store.getFreeCapacity() > 0) {
                creep.heap.targetId = storage.id;
                creep.heap.actionIntent = ActionConstants.ACTION_TRANSFER;
                return;
            }

            // Fallback
            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
        }
    }

    static assignDefender(creep, homeState) {
        // Priority 1: Defend home room
        if (homeState.hostiles && homeState.hostiles.length > 0) {
            if (creep.room.name !== creep.memory.colony) {
                creep.memory.targetRoom = creep.memory.colony;
                creep.heap.actionIntent = ActionConstants.ACTION_MOVE_ROOM;
                return;
            }
            creep.heap.targetId = homeState.hostiles[0].id;
            creep.heap.actionIntent = ActionConstants.ACTION_ATTACK;
            return;
        }

        // Priority 2: Defend outposts
        const outposts = Memory.rooms[creep.memory.colony]?.outposts || [];
        for (let i = 0; i < outposts.length; i++) {
            const outpostState = global.State.rooms.get(outposts[i]);
            if (outpostState && outpostState.hostiles && outpostState.hostiles.length > 0) {
                if (creep.room.name !== outposts[i]) {
                    creep.memory.targetRoom = outposts[i];
                    creep.heap.actionIntent = ActionConstants.ACTION_MOVE_ROOM;
                    return;
                }
                creep.heap.targetId = outpostState.hostiles[0].id;
                creep.heap.actionIntent = ActionConstants.ACTION_ATTACK;
                return;
            }
        }

        // Priority 3: Park near spawn when idle
        if (homeState.spawns && homeState.spawns.length > 0) {
            const spawn = homeState.spawns[0];
            creep.heap.waypointPos = { x: spawn.pos.x + 4, y: spawn.pos.y, roomName: creep.memory.colony };
        }
        creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
    }

    static assignRepairman(creep, homeState) {
        if (creep.heap.state === 'gather') {
            // Priority 1: Scavenge dropped energy
            const drops = homeState.droppedEnergy || [];
            let bestDrop = null;
            let bestAmount = 0;
            for (let i = 0; i < drops.length; i++) {
                const d = drops[i];
                const claimed = d.__gatherClaimed || 0;
                const available = d.amount - claimed;
                if (available > bestAmount) {
                    bestAmount = available;
                    bestDrop = d;
                }
            }
            if (bestDrop && bestAmount >= 25) {
                bestDrop.__gatherClaimed = (bestDrop.__gatherClaimed || 0) + creep.store.getFreeCapacity(RESOURCE_ENERGY);
                creep.heap.targetId = bestDrop.id;
                creep.heap.actionIntent = ActionConstants.ACTION_PICKUP;
                return;
            }

            // Priority 2: Harvest from source
            const sources = homeState.sources || [];
            if (sources.length > 0) {
                creep.heap.targetId = sources[0].id;
                creep.heap.actionIntent = ActionConstants.ACTION_HARVEST;
                return;
            }
            
            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
        } else {
            // Work phase: find repair targets in home and outposts
            let bestTarget = null;
            let lowestHealthRatio = 1.0;
            let targetRoom = creep.memory.colony;

            // Check home room
            if (homeState.repairTargets) {
                for (let i = 0; i < homeState.repairTargets.length; i++) {
                    const t = homeState.repairTargets[i];
                    const ratio = t.hits / t.hitsMax;
                    if (ratio < lowestHealthRatio && ratio < 0.8) {
                        lowestHealthRatio = ratio;
                        bestTarget = t;
                        targetRoom = creep.memory.colony;
                    }
                }
            }

            // Check outposts
            const outposts = Memory.rooms[creep.memory.colony]?.outposts || [];
            for (let o = 0; o < outposts.length; o++) {
                const outpostState = global.State.rooms.get(outposts[o]);
                if (outpostState && outpostState.repairTargets) {
                    for (let i = 0; i < outpostState.repairTargets.length; i++) {
                        const t = outpostState.repairTargets[i];
                        const ratio = t.hits / t.hitsMax;
                        if (ratio < lowestHealthRatio && ratio < 0.8) {
                            lowestHealthRatio = ratio;
                            bestTarget = t;
                            targetRoom = outposts[o];
                        }
                    }
                }
            }

            if (bestTarget) {
                if (creep.room.name !== targetRoom) {
                    creep.memory.targetRoom = targetRoom;
                    creep.heap.actionIntent = ActionConstants.ACTION_MOVE_ROOM;
                } else {
                    creep.heap.targetId = bestTarget.id;
                    creep.heap.actionIntent = ActionConstants.ACTION_REPAIR;
                }
            } else {
                // No repair targets — park at a safe idle position near spawn
                if (homeState.spawns && homeState.spawns.length > 0) {
                    const spawn = homeState.spawns[0];
                    creep.heap.waypointPos = { x: spawn.pos.x + 4, y: spawn.pos.y + 2, roomName: creep.memory.colony };
                }
                creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
            }
        }
    }
    static assignRemoteHarvester(creep, _homeState) {
        if (!creep.memory.targetRoom) {
            const outposts = Memory.rooms[creep.memory.colony]?.outposts || [];
            if (outposts.length > 0) {
                const counts = new Map();
                for (const name in Game.creeps) {
                    const c = Game.creeps[name];
                    if (c.memory.role === 'remoteHarvester' && c.memory.colony === creep.memory.colony && c.memory.targetRoom) {
                        counts.set(c.memory.targetRoom, (counts.get(c.memory.targetRoom) || 0) + 1);
                    }
                }

                let bestRoom = outposts[0];
                let minCount = Infinity;
                for (let i = 0; i < outposts.length; i++) {
                    const count = counts.get(outposts[i]) || 0;
                    if (count < minCount) {
                        minCount = count;
                        bestRoom = outposts[i];
                    }
                }
                creep.memory.targetRoom = bestRoom;
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
                    const counts = new Map();
                    for (const name in Game.creeps) {
                        const c = Game.creeps[name];
                        if (c.memory.role === 'remoteHauler' && c.memory.colony === creep.memory.colony && c.memory.targetRoom) {
                            counts.set(c.memory.targetRoom, (counts.get(c.memory.targetRoom) || 0) + 1);
                        }
                    }

                    let bestRoom = outposts[0];
                    let minCount = Infinity;
                    for (let i = 0; i < outposts.length; i++) {
                        const count = counts.get(outposts[i]) || 0;
                        if (count < minCount) {
                            minCount = count;
                            bestRoom = outposts[i];
                        }
                    }
                    creep.memory.targetRoom = bestRoom;
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

        // Lock source permanently to prevent target thrashing
        if (!creep.memory.targetId) {
            const counts = new Map();
            for (const name in Game.creeps) {
                const c = Game.creeps[name];
                if (c.memory.role === 'harvester' && c.memory.colony === creep.memory.colony && c.memory.targetId) {
                    counts.set(c.memory.targetId, (counts.get(c.memory.targetId) || 0) + 1);
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
            creep.memory.targetId = bestSource.id;
        }

        const source = Game.getObjectById(creep.memory.targetId);
        if (!source) return;

        let hasLinkTarget = false;

        // Link override: if adjacent to a link and carrying enough energy, transfer to it
        if (roomState.links && creep.store.getUsedCapacity(RESOURCE_ENERGY) >= 40) {
            for (let i = 0; i < roomState.links.length; i++) {
                const link = roomState.links[i];
                if (link.pos.getRangeTo(creep) <= 1 && link.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                    creep.heap.targetId = link.id;
                    creep.heap.actionIntent = ActionConstants.ACTION_TRANSFER;
                    hasLinkTarget = true;
                    break;
                }
            }
        }

        if (!hasLinkTarget) {
            creep.heap.targetId = creep.memory.targetId;
            creep.heap.actionIntent = ActionConstants.ACTION_HARVEST;
        }

        if (roomState.sourceContainers) {
            for (let i = 0; i < roomState.sourceContainers.length; i++) {
                const c = roomState.sourceContainers[i];
                if (c.pos.getRangeTo(source) <= 2) {
                    creep.heap.sitTargetId = c.id;
                    break;
                }
            }
        }
    }

    static assignHauler(creep, roomState) {
        if (creep.heap.state === 'gather') {
            // Priority 1: Scavenge from Ruins and Tombstones
            const scavengeTargets = [];
            if (roomState.ruins) {
                for (let i = 0; i < roomState.ruins.length; i++) {
                    if (roomState.ruins[i] && roomState.ruins[i].store && roomState.ruins[i].store.getUsedCapacity() > 0) scavengeTargets.push(roomState.ruins[i]);
                }
            }
            if (roomState.tombstones) {
                for (let i = 0; i < roomState.tombstones.length; i++) {
                    if (roomState.tombstones[i] && roomState.tombstones[i].store && roomState.tombstones[i].store.getUsedCapacity() > 0) scavengeTargets.push(roomState.tombstones[i]);
                }
            }
            let bestScavenge = null;
            let bestScavengeScore = -1;

            for (let i = 0; i < scavengeTargets.length; i++) {
                const target = scavengeTargets[i];
                const amount = target.store.getUsedCapacity();
                const claimed = target.__gatherClaimed || 0;
                const remaining = amount - claimed;

                if (remaining >= Math.min(25, creep.store.getFreeCapacity())) {
                    const dist = Math.max(Math.abs(creep.pos.x - target.pos.x), Math.abs(creep.pos.y - target.pos.y)) || 1;
                    const score = remaining / dist;
                    if (score > bestScavengeScore) {
                        bestScavengeScore = score;
                        bestScavenge = target;
                    }
                }
            }

            if (bestScavenge) {
                bestScavenge.__gatherClaimed = (bestScavenge.__gatherClaimed || 0) + creep.store.getFreeCapacity();
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

                    const amount = c.store.getUsedCapacity();
                    const claimed = c.__gatherClaimed || 0;
                    const remaining = amount - claimed;

                    if (remaining >= Math.min(25, creep.store.getFreeCapacity())) {
                        const dist = Math.max(Math.abs(creep.pos.x - c.pos.x), Math.abs(creep.pos.y - c.pos.y)) || 1;
                        const score = remaining / dist;
                        if (score > bestContainerScore) {
                            bestContainerScore = score;
                            bestContainer = c;
                        }
                    }
                }
                if (bestContainer) {
                    bestContainer.__gatherClaimed = (bestContainer.__gatherClaimed || 0) + creep.store.getFreeCapacity();
                    creep.heap.targetId = bestContainer.id;
                    creep.heap.actionIntent = ActionConstants.ACTION_WITHDRAW;
                    return;
                }
            }

            // Priority 2: Hashed assignment to specific harvester's drop zone
            const harvesters = roomState.harvesters || [];
            if (harvesters.length > 0) {
                // djb2 hash for even distribution across harvesters
                const targetHarvester = harvesters[MathLib.djb2Hash(creep.name) % harvesters.length];

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
                    bestTarget.__gatherClaimed = (bestTarget.__gatherClaimed || 0) + creep.store.getFreeCapacity();
                    creep.heap.targetId = bestTarget.id;
                    creep.heap.actionIntent = intent;
                    return;
                }
            }

            // Priority 3: If hauler has partial energy, go deliver it instead of waiting
            if (creep.store.getUsedCapacity() > 0) {
                creep.heap.state = 'work';
                TaskAssignmentManager.assignHaulerWork(creep, roomState);
            }
            // If truly empty and no targets: do nothing this tick, will retry next tick
        } else {
            TaskAssignmentManager.assignHaulerWork(creep, roomState);
        }
    }

    static assignHaulerWork(creep, roomState) {
        const totalUsed = creep.store.getUsedCapacity();
        const energyUsed = creep.store.getUsedCapacity(RESOURCE_ENERGY);
        const hasMinerals = totalUsed > energyUsed;

        // Mineral Override: If carrying non-energy, bypass core structures and strictly dump into Storage/Terminal
        if (hasMinerals) {
            if (roomState.storage && roomState.storage.store.getFreeCapacity() > 0) {
                creep.heap.targetId = roomState.storage.id;
                creep.heap.actionIntent = ActionConstants.ACTION_TRANSFER;
                return;
            }
            if (roomState.terminal && roomState.terminal.store.getFreeCapacity() > 0) {
                creep.heap.targetId = roomState.terminal.id;
                creep.heap.actionIntent = ActionConstants.ACTION_TRANSFER;
                return;
            }
            // Drop it near the controller if we have nowhere to put it
            if (roomState.controller) {
                creep.heap.targetId = roomState.controller.id;
                creep.heap.actionIntent = ActionConstants.ACTION_DROP;
                return;
            }
        }

        // Emergency Override: If storage exists but we have 0 alive fillers, haulers MUST step in to fill core structures
        const hasFiller = roomState.creepCounts && roomState.creepCounts['filler'] > 0;
        if (roomState.storage && !hasFiller) {
            if (TaskAssignmentManager.routeToCoreStructures(creep, roomState)) return;
        }

        // Priority 1: Dump in Storage if it exists
        if (roomState.storage && roomState.storage.store.getFreeCapacity() > 0) {
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
        // Priority 0: Emergency Repair (< 10,000 HP Ramparts/Walls)
        if (roomState.repairTargets?.length > 0) {
            let emergencyTarget = null;
            let emergencyDist = Infinity;
            for (let i = 0; i < roomState.repairTargets.length; i++) {
                const t = roomState.repairTargets[i];
                if ((t.structureType === STRUCTURE_RAMPART || t.structureType === STRUCTURE_WALL) && t.hits < 10000) {
                    const dx = Math.abs(creep.pos.x - t.pos.x);
                    const dy = Math.abs(creep.pos.y - t.pos.y);
                    const dist = Math.max(dx, dy);
                    if (dist < emergencyDist) {
                        emergencyDist = dist;
                        emergencyTarget = t;
                    }
                }
            }
            if (emergencyTarget) {
                creep.heap.targetId = emergencyTarget.id;
                creep.heap.actionIntent = ActionConstants.ACTION_REPAIR;
                return;
            }
        }

        // Priority 1: Build construction sites — prefer nearly-complete ones
        const siteIds = Object.keys(roomState.constructionSites || {});
        if (siteIds && siteIds.length > 0) {
            let bestSite = null;
            let bestScore = -1;
            for (let i = 0; i < siteIds.length; i++) {
                const s = CacheLib.getById(siteIds[i]) || roomState.constructionSites[siteIds[i]];
                if (!s) continue;
                const dx = Math.abs(creep.pos.x - s.pos.x);
                const dy = Math.abs(creep.pos.y - s.pos.y);
                const dist = Math.max(dx, dy) || 1;
                // Progress ratio: higher = closer to completion
                const progress = s.progressTotal > 0 ? s.progress / s.progressTotal : 0;
                // Score: prefer nearby + nearly-complete sites
                let score = (1 + progress * 3) * 100 / dist;
                
                // Emergency override: Storage is absolute top priority
                if (s.structureType === STRUCTURE_STORAGE) {
                    score += 10000;
                }
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

    /**
     * Prevents economic cannibalism by forbidding workers from draining core spawning infrastructure.
     */
    static findClosestEnergy(creep, roomState) {
        // Priority 1: Storage
        if (roomState.storage && roomState.storage.store.getUsedCapacity(RESOURCE_ENERGY) >= 50) {
            return { id: roomState.storage.id, actionIntent: ActionConstants.ACTION_WITHDRAW };
        }

        // Priority 2: Terminal
        if (roomState.terminal && roomState.terminal.store.getUsedCapacity(RESOURCE_ENERGY) >= 50) {
            return { id: roomState.terminal.id, actionIntent: ActionConstants.ACTION_WITHDRAW };
        }

        // Priority 3: Source Containers
        if (roomState.sourceContainers && roomState.sourceContainers.length > 0) {
            let bestTarget = null;
            let bestDist = Infinity;
            for (let i = 0; i < roomState.sourceContainers.length; i++) {
                const c = roomState.sourceContainers[i];
                if (c.store.getUsedCapacity(RESOURCE_ENERGY) >= 50) {
                    const dist = Math.max(Math.abs(creep.pos.x - c.pos.x), Math.abs(creep.pos.y - c.pos.y));
                    if (dist < bestDist) {
                        bestDist = dist;
                        bestTarget = c;
                    }
                }
            }
            if (bestTarget) return { id: bestTarget.id, actionIntent: ActionConstants.ACTION_WITHDRAW };
        }

        // Priority 4: Dropped Energy
        if (roomState.droppedEnergy && roomState.droppedEnergy.length > 0) {
            let bestTarget = null;
            let bestDist = Infinity;
            for (let i = 0; i < roomState.droppedEnergy.length; i++) {
                const drop = roomState.droppedEnergy[i];
                const claimed = drop.__gatherClaimed || 0;
                if (drop.amount - claimed >= 30) {
                    const dist = Math.max(Math.abs(creep.pos.x - drop.pos.x), Math.abs(creep.pos.y - drop.pos.y));
                    if (dist < bestDist) {
                        bestDist = dist;
                        bestTarget = drop;
                    }
                }
            }
            if (bestTarget) {
                bestTarget.__gatherClaimed = (bestTarget.__gatherClaimed || 0) + creep.store.getFreeCapacity(RESOURCE_ENERGY);
                return { id: bestTarget.id, actionIntent: ActionConstants.ACTION_PICKUP };
            }
        }

        // Priority 5: Spawn/Extensions (ONLY if RCL <= 3 AND no storage/sourceContainers)
        const rcl = roomState.controller ? roomState.controller.level : 0;
        const hasContainers = roomState.sourceContainers && roomState.sourceContainers.length > 0;
        
        if (rcl <= 3 && !roomState.storage && !hasContainers && roomState.spawns && roomState.spawns.length > 0) {
            let bestTarget = null;
            let bestDist = Infinity;
            for (let i = 0; i < roomState.spawns.length; i++) {
                const spawn = roomState.spawns[i];
                if (spawn.store.getUsedCapacity(RESOURCE_ENERGY) >= 300) {
                    const dist = Math.max(Math.abs(creep.pos.x - spawn.pos.x), Math.abs(creep.pos.y - spawn.pos.y));
                    if (dist < bestDist) {
                        bestDist = dist;
                        bestTarget = spawn;
                    }
                }
            }
            if (bestTarget) return { id: bestTarget.id, actionIntent: ActionConstants.ACTION_WITHDRAW };
        }

        return null;
    }

    static assignBootstrapper(creep, roomState) {
        if (creep.heap.state === 'gather') {
            // Priority 1: Pull from Storage if available
            if (roomState.storage && roomState.storage.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                creep.heap.targetId = roomState.storage.id;
                creep.heap.actionIntent = ActionConstants.ACTION_WITHDRAW;
                return;
            }

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
            const siteIds = Object.keys(roomState.constructionSites || {});
            if (siteIds && siteIds.length > 0) {
                let bestSite = null;
                let bestScore = -1;
                for (let i = 0; i < siteIds.length; i++) {
                    const s = CacheLib.getById(siteIds[i]) || roomState.constructionSites[siteIds[i]];
                    if (!s) continue;
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

        // Fixes upgrader spawn paralysis by enforcing strict physical routing to the controller before attempting to execute work intents.
        if (creep.pos.getRangeTo(roomState.controller) > 3) {
            creep.heap.destination = { x: roomState.controller.pos.x, y: roomState.controller.pos.y, roomName: roomState.controller.room.name, range: 3 };
            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
            return;
        }

        // If the upgrader needs energy, issue a gather intent first
        if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
            // Priority 0: Withdraw from adjacent link
            if (roomState.links) {
                for (let i = 0; i < roomState.links.length; i++) {
                    const link = roomState.links[i];
                    if (link.pos.getRangeTo(creep) <= 1 && link.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                        creep.heap.targetId = link.id;
                        creep.heap.actionIntent = ActionConstants.ACTION_WITHDRAW;
                        return;
                    }
                }
            }

            // Priority 1: Withdraw from controller container
            if (roomState.controllerContainers && roomState.controllerContainers.length > 0) {
                const c = roomState.controllerContainers[0];
                if (c.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                    creep.heap.targetId = c.id;
                    creep.heap.actionIntent = ActionConstants.ACTION_WITHDRAW;
                    return;
                }
            }
            // Priority 2: Pickup adjacent dropped energy
            if (roomState.droppedEnergy && roomState.droppedEnergy.length > 0) {
                for (let i = 0; i < roomState.droppedEnergy.length; i++) {
                    const d = roomState.droppedEnergy[i];
                    if (Math.max(Math.abs(creep.pos.x - d.pos.x), Math.abs(creep.pos.y - d.pos.y)) <= 3) {
                        creep.heap.targetId = d.id;
                        creep.heap.actionIntent = ActionConstants.ACTION_PICKUP;
                        return;
                    }
                }
            }
        }

        // Issue upgrade intent — Upgrader.js will handle movement
        creep.heap.targetId = roomState.controller.id;
        creep.heap.actionIntent = ActionConstants.ACTION_UPGRADE;
    }
}

module.exports = TaskAssignmentManager;