const ActionConstants = require('../constants/ActionConstants');
const CacheLib = require('../lib/CacheLib');
const MathLib = require('../lib/MathLib');
const SourceAssignmentModule = require('./task_modules/SourceAssignmentModule');
const TransferAssignmentModule = require('./task_modules/TransferAssignmentModule');
const WithdrawAssignmentModule = require('./task_modules/WithdrawAssignmentModule');
const UpgradeAssignmentModule = require('./task_modules/UpgradeAssignmentModule');



/**
 * Top-Down, Heap-Driven Task Assignment Manager
 * Optimized for strict Drop-Mining, Stationary Upgrading, and Distance-Weighted Hauling.
 */
class TaskAssignmentManager {
    static run(colony) {
        if (!global.creepHeap) global.creepHeap = new Map();
        
        // Ensure tick claims are reset exactly once per tick globally, not per colony
        if (global.tickClaimsTime !== Game.time) {
            global.tickClaims = new Map();
            global.tickClaimsTime = Game.time;
        }

        const creeps = colony.creeps;
        for (let i = 0; i < creeps.length; i++) {
            const creep = creeps[i];
            if (creep.spawning) continue;
            
            try {
                // Scouts are managed exclusively by ScoutingManager — skip to prevent heap overwrite
                const rawRole = creep.memory.role || '';
                if (rawRole.toLowerCase() === 'scout') continue;

                // The primary room state context is the room the creep is CURRENTLY in.
                const roomName = creep.room.name;
                const roomState = global.State?.rooms?.get(roomName);
                if (!roomState) continue;

                let heap = global.creepHeap.get(creep.name);
                if (!heap) {
                    heap = CacheLib.getDefaultHeap();
                    global.creepHeap.set(creep.name, heap);
                }
                creep.heap = heap;

                if (Game.time < creep.heap.sleepUntil) continue;

                TaskAssignmentManager.updateCreepState(creep);

                if (creep.heap.actionIntent !== ActionConstants.ACTION_IDLE && creep.heap.actionIntent !== null) {
                    TaskAssignmentManager.validateCurrentTask(creep);

                    if (creep.heap.actionIntent !== ActionConstants.ACTION_IDLE) {
                        TaskAssignmentManager.reregisterClaim(creep);
                        continue;
                    }
                }
                
                if (TaskAssignmentManager.checkCivilianFlee(creep, roomState)) {
                    continue;
                }

                TaskAssignmentManager.assignTask(creep, roomState);
            } catch (err) {
                console.log(`[ERROR] TaskAssignmentManager crashed for creep ${creep.name}: ${err.message}\n${err.stack}`);
            }
        }
    }

    static reregisterClaim(creep) {
        if (!creep.heap.targetId) return;
        const target = CacheLib.getById(creep.heap.targetId);
        if (!target) return;

        const claimKey = `${creep.heap.targetId}_${creep.heap.state}`;
        const currentClaim = global.tickClaims.get(claimKey) || 0;

        if (creep.heap.state === 'gather') {
            global.tickClaims.set(claimKey, currentClaim + creep.store.getFreeCapacity());
        } else if (creep.heap.state === 'work' && (creep.heap.actionIntent === ActionConstants.ACTION_TRANSFER || creep.heap.actionIntent === ActionConstants.ACTION_BUILD)) {
            global.tickClaims.set(claimKey, currentClaim + creep.store.getUsedCapacity(RESOURCE_ENERGY));
        }
    }

    static updateCreepState(creep) {
        const role = creep.memory.role || '';

        // Harvesters and Upgraders are stationary roles and do not use gather/work cycles
        if (role === 'harvester' || role === 'upgrader' || role === 'remoteharvester') return;

        const totalUsed = creep.store.getUsedCapacity();
        const free = creep.store.getFreeCapacity(RESOURCE_ENERGY);

        if (!creep.heap.state || creep.heap.state === 'idle') {
            // Force all worker creeps to completely empty before gathering again
            if (totalUsed > 0) {
                creep.heap.state = 'work';
            } else {
                creep.heap.state = 'gather';
            }
        }

        if (creep.heap.state === 'gather' && free === 0) {
            creep.heap.state = 'work';
            creep.heap.targetId = null;
            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
            creep.heap.unreachableTargetId = null;
        } else if (creep.heap.state === 'work' && totalUsed === 0) {
            creep.heap.state = 'gather';
            creep.heap.targetId = null;
            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
            creep.heap.unreachableTargetId = null;
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
                (target.store && target.store.getUsedCapacity(RESOURCE_ENERGY) < 50) ||
                (target.energy !== undefined && target.energy === 0)) {
                creep.heap.targetId = null;
                creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
            }
        } else if (creep.heap.state === 'work') {
            if (creep.store.getUsedCapacity() === 0 ||
                (target.store && target.store.getFreeCapacity() === 0) ||
                (creep.heap.actionIntent === ActionConstants.ACTION_UPGRADE && creep.memory.role !== 'upgrader')) {
                creep.heap.targetId = null;
                creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
            }
        }
    }

    static checkCivilianFlee(creep, roomState) {
        const role = (creep.memory.role || '').toLowerCase();
        if (role === 'meleecreep' || role === 'rangercreep' || role === 'mediccreep' || role === 'defender') {
            return false;
        }

        const hostiles = roomState.hostiles;
        if (!hostiles || hostiles.length === 0) {
            if (creep.heap.fleeGoals) creep.heap.fleeGoals = null;
            return false;
        }

        // Check if the civilian is standing on a rampart. If so, they are safe and do not need to flee.
        let onRampart = false;
        if (roomState.ramparts) {
            for (let i = 0; i < roomState.rampartCount; i++) {
                const r = roomState.ramparts[i];
                if (r.pos.x === creep.pos.x && r.pos.y === creep.pos.y) {
                    onRampart = true;
                    break;
                }
            }
        }
        
        if (onRampart) {
            if (creep.heap.fleeGoals) creep.heap.fleeGoals = null;
            return false;
        }

        let nearHostile = false;
        const fleeGoals = [];
        for (let i = 0; i < hostiles.length; i++) {
            const h = hostiles[i];
            if (Math.max(Math.abs(creep.pos.x - h.pos.x), Math.abs(creep.pos.y - h.pos.y)) <= 5) {
                nearHostile = true;
            }
            fleeGoals.push({ pos: h.pos, range: 7 });
        }

        if (nearHostile) {
            creep.heap.fleeGoals = fleeGoals;
            creep.heap.actionIntent = ActionConstants.ACTION_MOVE;
            creep.heap.targetId = null;
            creep.heap.state = 'fleeing';
            return true;
        }

        if (creep.heap.fleeGoals) creep.heap.fleeGoals = null;
        return false;
    }

    static assignTask(creep, roomState) {
        const role = (creep.memory.role || '').toLowerCase();
        // Military creeps are managed exclusively by MilitaryManager — skip to prevent heap overwrite
        if (role === 'meleecreep' || role === 'rangercreep' || role === 'mediccreep') return;

        // End-of-Life Task Abortion
        // Prevents dying creeps from accepting new withdraw/harvest tasks, forcing them to dump their inventory into core storage before expiring.
        if ((role === 'hauler' || role === 'filler' || role === 'upgrader' || role === 'builder') && creep.ticksToLive < 30) {
            if (creep.store.getUsedCapacity() > 0) {
                let dumpTarget = null;
                if (roomState.storage && roomState.storage.store.getFreeCapacity() > 0) dumpTarget = roomState.storage;
                else if (roomState.terminal && roomState.terminal.store.getFreeCapacity() > 0) dumpTarget = roomState.terminal;
                else if (roomState.spawns && roomState.spawnCount > 0) {
                    for(let i=0; i<roomState.spawnCount; i++) {
                        if (roomState.spawns[i].store.getFreeCapacity(RESOURCE_ENERGY) > 0) { dumpTarget = roomState.spawns[i]; break; }
                    }
                }
                
                if (dumpTarget) {
                    creep.heap.targetId = dumpTarget.id;
                    creep.heap.actionIntent = ActionConstants.ACTION_TRANSFER;
                } else {
                    creep.heap.actionIntent = ActionConstants.ACTION_SUICIDE;
                }
                return;
            } else {
                creep.heap.actionIntent = ActionConstants.ACTION_SUICIDE;
                return;
            }
        }
        if (role === 'harvester') SourceAssignmentModule.assignHarvester(creep, roomState);
        else if (role === 'hauler') TaskAssignmentManager.assignHauler(creep, roomState);
        else if (role === 'builder') TaskAssignmentManager.assignBuilder(creep, roomState);
        else if (role === 'pioneer') TaskAssignmentManager.assignPioneer(creep, roomState);
        else if (role === 'bootstrapper') TaskAssignmentManager.assignBootstrapper(creep, roomState);
        else if (role === 'upgrader') UpgradeAssignmentModule.assignUpgrader(creep, roomState);
        else if (role === 'filler') TaskAssignmentManager.assignFiller(creep, roomState);
        else if (role === 'fastfiller') TaskAssignmentManager.assignFastFiller(creep, roomState);
        else if (role === 'remoteharvester') TaskAssignmentManager.assignRemoteHarvester(creep, roomState);
        else if (role === 'remotehauler') TaskAssignmentManager.assignRemoteHauler(creep, roomState);
        else if (role === 'reserver') TaskAssignmentManager.assignReserver(creep, roomState);
        else if (role === 'defender') TaskAssignmentManager.assignDefender(creep, roomState);
        else if (role === 'hubmanager') TaskAssignmentManager.assignHubManager(creep, roomState);
        else if (role === 'mineralminer') TaskAssignmentManager.assignMineralMiner(creep, roomState);
        else if (role === 'mineralhauler') TaskAssignmentManager.assignMineralHauler(creep, roomState);
        else if (role === 'claimer') TaskAssignmentManager.assignClaimer(creep, roomState);
        else if (role === 'scientist') TaskAssignmentManager.assignScientist(creep, roomState);
    }

    static assignPioneer(creep, roomState) {
        const targetRoom = Memory.empire?.colonizeRoom;
        if (!targetRoom) {
            // Expansion finished or aborted, act as builder
            TaskAssignmentManager.assignBuilder(creep, roomState);
            return;
        }

        if (creep.room.name !== targetRoom) {
            creep.memory.targetRoom = targetRoom;
            creep.heap.actionIntent = ActionConstants.ACTION_MOVE_ROOM;
            creep.heap.state = 'moving';
            return;
        }

        // We are in the target room. Act as a bootstrapper.
        TaskAssignmentManager.assignBootstrapper(creep, roomState);
    }

    static assignMineralMiner(creep, roomState) {
        if (!roomState.mineral || roomState.mineral.mineralAmount === 0) {
            if (creep.store.getUsedCapacity() > 0) {
                creep.heap.state = 'work';
                TaskAssignmentManager.assignHaulerWork(creep, roomState);
                return;
            }
            if (roomState.mineral && roomState.mineral.ticksToRegeneration) {
                creep.heap.sleepUntil = Game.time + roomState.mineral.ticksToRegeneration;
            }
            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
            return;
        }

        let minerContainer = null;
        if (roomState.containers) {
            for (let i = 0; i < roomState.containers.length; i++) {
                const c = roomState.containers[i];
                if (Math.max(Math.abs(c.pos.x - roomState.mineral.pos.x), Math.abs(c.pos.y - roomState.mineral.pos.y)) <= 1) {
                    minerContainer = c;
                    break;
                }
            }
        }

        if (minerContainer) {
            if (creep.pos.x !== minerContainer.pos.x || creep.pos.y !== minerContainer.pos.y) {
                creep.heap.destination = { x: minerContainer.pos.x, y: minerContainer.pos.y, roomName: creep.room.name, range: 0 };
                creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
            } else {
                creep.heap.targetId = roomState.mineral.id;
                creep.heap.actionIntent = ActionConstants.ACTION_HARVEST;
            }
        } else {
            if (Math.max(Math.abs(creep.pos.x - roomState.mineral.pos.x), Math.abs(creep.pos.y - roomState.mineral.pos.y)) > 1) {
                creep.heap.destination = { x: roomState.mineral.pos.x, y: roomState.mineral.pos.y, roomName: creep.room.name, range: 1 };
                creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
            } else {
                creep.heap.targetId = roomState.mineral.id;
                creep.heap.actionIntent = ActionConstants.ACTION_HARVEST;
            }
        }
    }

    static assignHubManager(creep, roomState) {
        const terminal = roomState.terminal;
        const storage = roomState.storage;
        
        let hubLink = null;
        if (roomState.links && storage) {
            for (let i = 0; i < roomState.links.length; i++) {
                if (roomState.links[i].pos.inRangeTo(storage, 2)) {
                    hubLink = roomState.links[i];
                    break;
                }
            }
        }

        if (!storage || !terminal || !hubLink) {
            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
            return;
        }

        // Permanent sit target: Find a tile that is range 1 to storage, terminal, and hubLink
        if (!creep.heap.sitPos) {
            for (let dx = -1; dx <= 1; dx++) {
                let found = false;
                for (let dy = -1; dy <= 1; dy++) {
                    const x = storage.pos.x + dx;
                    const y = storage.pos.y + dy;
                    if (Math.max(Math.abs(x - terminal.pos.x), Math.abs(y - terminal.pos.y)) <= 1 &&
                        Math.max(Math.abs(x - hubLink.pos.x), Math.abs(y - hubLink.pos.y)) <= 1) {
                        creep.heap.sitPos = { x, y, roomName: roomState.name || creep.room.name };
                        found = true;
                        break;
                    }
                }
                if (found) break;
            }
        }

        if (creep.heap.sitPos && (creep.pos.x !== creep.heap.sitPos.x || creep.pos.y !== creep.heap.sitPos.y)) {
            creep.heap.destination = { x: creep.heap.sitPos.x, y: creep.heap.sitPos.y, roomName: creep.heap.sitPos.roomName, range: 0 };
            creep.heap.actionIntent = ActionConstants.ACTION_MOVE;
            return;
        }

        if (creep.heap.state === 'gather') {
            // Priority 1: Empty Hub Link
            if (hubLink.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                creep.heap.targetId = hubLink.id;
                creep.heap.actionIntent = ActionConstants.ACTION_WITHDRAW;
                return;
            }

            // Priority 2: Storage -> Terminal if storage is overflowing (> 500k)
            if (storage.store.getUsedCapacity(RESOURCE_ENERGY) > 500000 && terminal.store.getFreeCapacity() > 0) {
                creep.heap.targetId = storage.id;
                creep.heap.actionIntent = ActionConstants.ACTION_WITHDRAW;
                return;
            }

            // Priority 3: Terminal overflow -> Storage
            if (terminal.store.getUsedCapacity(RESOURCE_ENERGY) > 100000 && storage.store.getFreeCapacity() > 0) {
                creep.heap.targetId = terminal.id;
                creep.heap.actionIntent = ActionConstants.ACTION_WITHDRAW;
                return;
            }

            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
        } else {
            // Work phase (we are holding energy)
            
            // Priority 1: Fill Terminal if we withdrew from Storage due to overflow
            if (storage.store.getUsedCapacity(RESOURCE_ENERGY) > 500000 && terminal.store.getFreeCapacity() > 0) {
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

    static assignMineralHauler(creep, roomState) {
        if (creep.heap.state === 'gather') {
            if (!roomState.mineral) {
                creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
                return;
            }
            
            let targetContainer = null;
            if (roomState.containers) {
                for (let i = 0; i < roomState.containers.length; i++) {
                    const c = roomState.containers[i];
                    if (Math.max(Math.abs(c.pos.x - roomState.mineral.pos.x), Math.abs(c.pos.y - roomState.mineral.pos.y)) <= 1) {
                        if (c.store.getUsedCapacity() - c.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                            targetContainer = c;
                            break;
                        }
                    }
                }
            }

            if (targetContainer) {
                creep.heap.targetId = targetContainer.id;
                creep.heap.actionIntent = ActionConstants.ACTION_WITHDRAW;
                // Since this is a generic withdraw, ActionExecutor will need to pull all non-energy resources.
                // It will be handled automatically if ActionExecutor pulls the highest amount resource.
            } else {
                creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
            }
        } else {
            // Drop off in Terminal, fallback to Storage
            const target = roomState.terminal || roomState.storage;
            if (target && target.store.getFreeCapacity() > 0) {
                creep.heap.targetId = target.id;
                creep.heap.actionIntent = ActionConstants.ACTION_TRANSFER;
            } else {
                creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
            }
        }
    }

    static assignClaimer(creep, _roomState) {
        const targetRoom = Memory.empire?.colonizeRoom;
        if (!targetRoom) {
            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
            return;
        }

        if (creep.room.name !== targetRoom) {
            creep.memory.targetRoom = targetRoom;
            creep.heap.actionIntent = ActionConstants.ACTION_MOVE_ROOM;
            return;
        }

        const targetRoomState = global.State?.rooms?.get(creep.room.name);
        if (targetRoomState && targetRoomState.controller) {
            creep.heap.targetId = targetRoomState.controller.id;
            creep.heap.actionIntent = ActionConstants.ACTION_CLAIM;
        } else {
            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
        }
    }

    static assignScientist(creep, _roomState) {
        // Skeleton logic for Scientist
        if (creep.heap.state === 'gather') {
            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
        } else {
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

    static getRemoteCensus() {
        if (global.remoteCensusTick !== Game.time) {
            global.remoteCensus = new Map();
            global.remoteCensusTick = Game.time;
            for (const name in Game.creeps) {
                const c = Game.creeps[name];
                if (c.memory.targetRoom) {
                    const key = `${c.memory.role}_${c.memory.colony}_${c.memory.targetRoom}`;
                    global.remoteCensus.set(key, (global.remoteCensus.get(key) || 0) + 1);
                }
            }
        }
        return global.remoteCensus;
    }

    static assignRemoteHarvester(creep, _homeState) {
        if (!creep.memory.targetRoom) {
            const outposts = Memory.rooms[creep.memory.colony]?.outposts || [];
            if (outposts.length > 0) {
                const census = TaskAssignmentManager.getRemoteCensus();
                let bestRoom = outposts[0];
                let minCount = Infinity;
                for (let i = 0; i < outposts.length; i++) {
                    const key = `remoteHarvester_${creep.memory.colony}_${outposts[i]}`;
                    const count = census.get(key) || 0;
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

        SourceAssignmentModule.assignHarvester(creep, roomState);
    }

    static assignReserver(creep, _roomState) {
        if (!creep.memory.targetRoom) {
            const outposts = Memory.rooms[creep.memory.colony]?.outposts || [];
            if (outposts.length > 0) {
                const census = TaskAssignmentManager.getRemoteCensus();
                let bestRoom = outposts[0];
                let minCount = Infinity;
                for (let i = 0; i < outposts.length; i++) {
                    const key = `reserver_${creep.memory.colony}_${outposts[i]}`;
                    const count = census.get(key) || 0;
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

        const targetRoomState = global.State?.rooms?.get(creep.room.name);
        if (targetRoomState && targetRoomState.controller) {
            creep.heap.targetId = targetRoomState.controller.id;
            creep.heap.actionIntent = ActionConstants.ACTION_RESERVE;
        } else {
            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
        }
    }

    static assignRemoteHauler(creep, homeState) {
        if (creep.heap.state === 'gather') {
            if (!creep.memory.targetRoom) {
                const outposts = Memory.rooms[creep.memory.colony]?.outposts || [];
                if (outposts.length > 0) {
                    const census = TaskAssignmentManager.getRemoteCensus();
                    let bestRoom = outposts[0];
                    let minCount = Infinity;
                    for (let i = 0; i < outposts.length; i++) {
                        const key = `remoteHauler_${creep.memory.colony}_${outposts[i]}`;
                        const count = census.get(key) || 0;
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

            // Priority: Assigned Target Source
            if (creep.memory.targetSource) {
                const result = TaskAssignmentManager.getEnergyNearSource(creep, creep.memory.targetSource, roomState);
                if (result) {
                    creep.heap.targetId = result.target.id;
                    creep.heap.actionIntent = result.intent;
                    return;
                }
            }

            let bestTarget = null;
            let bestAmount = 0;
            const drops = roomState.droppedEnergy || [];
            for (let i = 0; i < drops.length; i++) {
                const d = drops[i];
                const claimKey = `${d.id}_gather`;
                const claimed = global.tickClaims.get(claimKey) || 0;
                const available = d.amount - claimed;
                if (available > bestAmount) {
                    bestAmount = available;
                    bestTarget = d;
                }
            }

            if (bestTarget && bestAmount >= 25) {
                const claimKey = `${bestTarget.id}_gather`;
                global.tickClaims.set(claimKey, (global.tickClaims.get(claimKey) || 0) + creep.store.getFreeCapacity(RESOURCE_ENERGY));
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

    static assignFastFiller(creep, roomState) {
        const blueprint = global.Cache?.blueprints?.get(creep.room.name);
        if (!blueprint || !blueprint.anchor) {
            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
            return;
        }

        const ax = blueprint.anchor.x;
        const ay = blueprint.anchor.y;

        const stands = [
            { x: ax - 1, y: ay - 1 },
            { x: ax + 1, y: ay - 1 },
            { x: ax - 1, y: ay + 1 },
            { x: ax + 1, y: ay + 1 }
        ];

        if (!creep.heap.sitTargetId) {
            let bestStand = null;
            for (let i = 0; i < stands.length; i++) {
                const s = stands[i];
                let occupied = false;
                for (const name in Game.creeps) {
                    const other = Game.creeps[name];
                    if (other.id === creep.id) continue;
                    if (other.memory.role === 'fastfiller' && other.heap && other.heap.sitPos) {
                        if (other.heap.sitPos.x === s.x && other.heap.sitPos.y === s.y) occupied = true;
                    }
                }
                if (!occupied) {
                    bestStand = s;
                    break;
                }
            }
            if (bestStand) {
                creep.heap.sitPos = bestStand;
                creep.heap.sitTargetId = 'stand_' + bestStand.x + '_' + bestStand.y;
            }
        }

        if (creep.heap.sitPos) {
            if (creep.pos.x !== creep.heap.sitPos.x || creep.pos.y !== creep.heap.sitPos.y) {
                creep.heap.destination = { x: creep.heap.sitPos.x, y: creep.heap.sitPos.y, roomName: creep.room.name, range: 0 };
                creep.heap.actionIntent = ActionConstants.ACTION_MOVE;
                return;
            }
        }

        if (creep.heap.state === 'gather') {
            let energySource = null;
            if (roomState.links) {
                for (let i = 0; i < roomState.linkCount; i++) {
                    const l = roomState.links[i];
                    if (l.pos.x === ax && l.pos.y === ay && l.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                        energySource = l; break;
                    }
                }
            }
            if (!energySource && roomState.containers) {
                for (let i = 0; i < roomState.containerCount; i++) {
                    const c = roomState.containers[i];
                    if ((c.pos.x === ax - 2 || c.pos.x === ax + 2) && c.pos.y === ay && c.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                        energySource = c; break;
                    }
                }
            }
            if (energySource) {
                creep.heap.targetId = energySource.id;
                creep.heap.actionIntent = ActionConstants.ACTION_WITHDRAW;
            } else {
                creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
            }
        } else {
            let target = null;
            if (roomState.spawns) {
                for (let i = 0; i < roomState.spawnCount; i++) {
                    const s = roomState.spawns[i];
                    if (s.store.getFreeCapacity(RESOURCE_ENERGY) > 0 && creep.pos.isNearTo(s)) {
                        target = s; break;
                    }
                }
            }
            if (!target && roomState.extensions) {
                for (let i = 0; i < roomState.extensionCount; i++) {
                    const e = roomState.extensions[i];
                    if (e.store.getFreeCapacity(RESOURCE_ENERGY) > 0 && creep.pos.isNearTo(e)) {
                        target = e; break;
                    }
                }
            }
            
            if (target) {
                creep.heap.targetId = target.id;
                creep.heap.actionIntent = ActionConstants.ACTION_TRANSFER;
            } else {
                creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
            }
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
            if (TransferAssignmentModule.routeToCoreStructures(creep, roomState)) return;
            // No core structures need energy? Idle.
            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
        }
    }

    static getEnergyNearSource(creep, targetSourceId, roomState) {
        let bestTarget = null;
        let bestAmount = 0;
        let intent = '';

        const sourceObj = CacheLib.getById(targetSourceId);
        if (!sourceObj) return null;

        if (roomState.containers) {
            for (let i = 0; i < roomState.containers.length; i++) {
                const c = roomState.containers[i];
                if (Math.max(Math.abs(c.pos.x - sourceObj.pos.x), Math.abs(c.pos.y - sourceObj.pos.y)) <= 2) {
                    const amount = c.store.getUsedCapacity(RESOURCE_ENERGY);
                    const claimKey = `${c.id}_gather`;
                    const claimed = global.tickClaims.get(claimKey) || 0;
                    const available = amount - claimed;
                    if (available > bestAmount && available >= Math.min(25, creep.store.getFreeCapacity())) {
                        bestAmount = available;
                        bestTarget = c;
                        intent = ActionConstants.ACTION_WITHDRAW;
                    }
                }
            }
        }

        if (roomState.droppedEnergy) {
            for (let i = 0; i < roomState.droppedEnergy.length; i++) {
                const d = roomState.droppedEnergy[i];
                if (Math.max(Math.abs(d.pos.x - sourceObj.pos.x), Math.abs(d.pos.y - sourceObj.pos.y)) <= 2) {
                    const claimKey = `${d.id}_gather`;
                    const claimed = global.tickClaims.get(claimKey) || 0;
                    const available = d.amount - claimed;
                    if (available > bestAmount && available >= 25) {
                        bestAmount = available;
                        bestTarget = d;
                        intent = ActionConstants.ACTION_PICKUP;
                    }
                }
            }
        }

        if (bestTarget) {
            const claimKey = `${bestTarget.id}_gather`;
            global.tickClaims.set(claimKey, (global.tickClaims.get(claimKey) || 0) + creep.store.getFreeCapacity());
            return { target: bestTarget, intent: intent };
        }
        return null;
    }

    static assignHauler(creep, roomState) {
        if (creep.heap.state === 'gather') {
            // Priority 0: Assigned Target Source
            if (creep.memory.targetSource) {
                const result = TaskAssignmentManager.getEnergyNearSource(creep, creep.memory.targetSource, roomState);
                if (result) {
                    creep.heap.targetId = result.target.id;
                    creep.heap.actionIntent = result.intent;
                    return;
                }
            }

            // Priority 1: Scavenge from Ruins and Tombstones
            let bestScavenge = null;
            let bestScavengeScore = -1;

            const evaluateScavenge = (target) => {
                if (!target || !target.store || target.store.getUsedCapacity() === 0) return;
                const amount = target.store.getUsedCapacity();
                const claimKey = `${target.id}_gather`;
                const claimed = global.tickClaims.get(claimKey) || 0;
                const remaining = amount - claimed;

                if (remaining >= Math.min(25, creep.store.getFreeCapacity())) {
                    const dist = Math.max(Math.abs(creep.pos.x - target.pos.x), Math.abs(creep.pos.y - target.pos.y)) || 1;
                    const score = remaining / dist;
                    if (score > bestScavengeScore) {
                        bestScavengeScore = score;
                        bestScavenge = target;
                    }
                }
            };

            if (roomState.ruins) {
                for (let i = 0; i < roomState.ruins.length; i++) evaluateScavenge(roomState.ruins[i]);
            }
            if (roomState.tombstones) {
                for (let i = 0; i < roomState.tombstones.length; i++) evaluateScavenge(roomState.tombstones[i]);
            }

            if (bestScavenge) {
                const claimKey = `${bestScavenge.id}_gather`;
                global.tickClaims.set(claimKey, (global.tickClaims.get(claimKey) || 0) + creep.store.getFreeCapacity());
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
                    if (roomState.controller && Math.max(Math.abs(c.pos.x - roomState.controller.pos.x), Math.abs(c.pos.y - roomState.controller.pos.y)) <= 3) continue;

                    const amount = c.store.getUsedCapacity();
                    const claimKey = `${c.id}_gather`;
                    const claimed = global.tickClaims.get(claimKey) || 0;
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
                    const claimKey = `${bestContainer.id}_gather`;
                    global.tickClaims.set(claimKey, (global.tickClaims.get(claimKey) || 0) + creep.store.getFreeCapacity());
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
                    // Skip drops near the controller (these are for upgraders/bootstrappers!)
                    if (roomState.controller && Math.max(Math.abs(d.pos.x - roomState.controller.pos.x), Math.abs(d.pos.y - roomState.controller.pos.y)) <= 3) continue;

                    if (Math.max(Math.abs(d.pos.x - targetHarvester.pos.x), Math.abs(d.pos.y - targetHarvester.pos.y)) <= 2) {
                        const claimKey = `${d.id}_gather`;
                        const claimed = global.tickClaims.get(claimKey) || 0;
                        const available = d.amount - claimed;
                        if (available > bestAmount) {
                            bestAmount = available;
                            bestTarget = d;
                            intent = ActionConstants.ACTION_PICKUP;
                        }
                    }
                }

                if (bestTarget && bestAmount >= 25) {
                    const claimKey = `${bestTarget.id}_gather`;
                    global.tickClaims.set(claimKey, (global.tickClaims.get(claimKey) || 0) + creep.store.getFreeCapacity());
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
        const hasFiller = roomState.creepCounts && (roomState.creepCounts['filler'] > 0 || roomState.creepCounts['fastfiller'] > 0);
        if (roomState.storage && !hasFiller) {
            if (TransferAssignmentModule.routeToCoreStructures(creep, roomState)) return;
        }

        // Priority 1: Dump in Storage if it exists
        if (roomState.storage && roomState.storage.store.getFreeCapacity() > 0) {
            creep.heap.targetId = roomState.storage.id;
            creep.heap.actionIntent = ActionConstants.ACTION_TRANSFER;
            return;
        }

        // Priority 2: Fill spawn/extensions (Pre-Storage behavior)
        if (TransferAssignmentModule.routeToCoreStructures(creep, roomState)) return;

        // Priority 2: Drop/Transfer at controller
        if (roomState.controller) {
            // Check if controller has a container
            let controllerContainer = null;
            if (roomState.containers) {
                for (let i = 0; i < roomState.containers.length; i++) {
                    const c = roomState.containers[i];
                    if (Math.max(Math.abs(c.pos.x - roomState.controller.pos.x), Math.abs(c.pos.y - roomState.controller.pos.y)) <= 3) {
                        controllerContainer = c;
                        break;
                    }
                }
            }

            if (controllerContainer) {
                creep.heap.targetId = controllerContainer.id;
                creep.heap.actionIntent = ActionConstants.ACTION_TRANSFER;
            } else {
                // Find planned container
                const blueprint = global.Cache?.blueprints?.get(creep.room.name);
                let plannedContainerTile = null;
                if (blueprint && blueprint.containers) {
                    for (let i = 0; i < blueprint.containers.length; i++) {
                        const tile = blueprint.containers[i];
                        if (Math.abs(tile.x - roomState.controller.pos.x) <= 3 && Math.abs(tile.y - roomState.controller.pos.y) <= 3) {
                            plannedContainerTile = tile;
                            break;
                        }
                    }
                }

                if (plannedContainerTile) {
                    const distToTile = Math.max(Math.abs(creep.pos.x - plannedContainerTile.x), Math.abs(creep.pos.y - plannedContainerTile.y));
                    if (distToTile > 1) { // Walk to adjacent at least!
                        creep.heap.destination = { x: plannedContainerTile.x, y: plannedContainerTile.y, roomName: creep.room.name, range: 1 };
                        creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
                        return;
                    } else {
                        // We are within range 1 of the exact tile! Drop it!
                        creep.heap.targetId = roomState.controller.id; // Fallback target ID for execution validator
                        creep.heap.actionIntent = ActionConstants.ACTION_DROP;
                        return;
                    }
                } else {
                    // Absolute fallback if blueprint is completely broken
                    if (Math.max(Math.abs(creep.pos.x - roomState.controller.pos.x), Math.abs(creep.pos.y - roomState.controller.pos.y)) > 3) {
                        creep.heap.destination = { x: roomState.controller.pos.x, y: roomState.controller.pos.y, roomName: creep.room.name, range: 3 };
                        creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
                    } else {
                        creep.heap.targetId = roomState.controller.id;
                        creep.heap.actionIntent = ActionConstants.ACTION_DROP;
                    }
                }
            }
        }
    }

    static assignBuilder(creep, roomState) {
        if (creep.heap.state === 'gather') {
            // Distance-aware energy source selection
            const bestSource = WithdrawAssignmentModule.findClosestEnergy(creep, roomState);
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
        // Priority 0: Critical Decay Repair (Ramparts/Walls < 100,000 HP)
        if (roomState.repairTargets?.length > 0) {
            let emergencyTarget = null;
            let emergencyDist = Infinity;
            for (let i = 0; i < roomState.repairTargets.length; i++) {
                const t = roomState.repairTargets[i];
                if ((t.structureType === STRUCTURE_RAMPART || t.structureType === STRUCTURE_WALL) && t.hits < 100000) {
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
        if (roomState.constructionSites) {
            let bestSite = null;
            let bestScore = -1;
            for (const siteId in roomState.constructionSites) {
                const s = CacheLib.getById(siteId) || roomState.constructionSites[siteId];
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

        // Priority 2: Generic Repair (Decay maintenance)
        if (roomState.repairTargets?.length > 0) {
            let bestTarget = null;
            let bestDist = Infinity;
            for (let i = 0; i < roomState.repairTargets.length; i++) {
                const t = roomState.repairTargets[i];
                // Cap general repairs for walls/ramparts so builders don't get stuck forever
                if ((t.structureType === STRUCTURE_WALL || t.structureType === STRUCTURE_RAMPART) && t.hits > 500000) continue;
                if (t.hits >= t.hitsMax * 0.8) continue;
                
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


    /**
     * Prevents economic cannibalism by forbidding workers from draining core spawning infrastructure.
     * Hardened against drop-mining by forcing a strict state machine transition.
     */
    static assignBootstrapper(creep, roomState) {
        // Anti-Drop-Mining Lock: Force transition the exact tick capacity is reached
        if (creep.heap.state === 'gather' && creep.store.getFreeCapacity() === 0) {
            creep.heap.state = 'work';
            creep.heap.targetId = null;
            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
        }

        if (creep.heap.state === 'gather') {
            // Priority 1: Pull from Storage if available (fastest recovery)
            if (roomState.storage && roomState.storage.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                creep.heap.targetId = roomState.storage.id;
                creep.heap.actionIntent = ActionConstants.ACTION_WITHDRAW;
                return;
            }

            // Priority 2: Scavenge dropped energy/ruins (faster than mining)
            const bestSource = WithdrawAssignmentModule.findClosestEnergy(creep, roomState);
            if (bestSource) {
                creep.heap.targetId = bestSource.id;
                creep.heap.actionIntent = bestSource.actionIntent;
                return;
            }

            // Fallback: Harvest directly from assigned source
            if (roomState.sources && roomState.sources.length > 0) {
                const targetSource = roomState.sources[MathLib.djb2Hash(creep.name) % roomState.sources.length];
                creep.heap.targetId = targetSource.id;
                creep.heap.actionIntent = ActionConstants.ACTION_HARVEST;
                return;
            }
        } else {
            // Work phase: Fill Spawns/Extensions first to get real creeps spawning (ignore towers)
            if (TransferAssignmentModule.routeToCoreStructures(creep, roomState, false)) return;

            // Priority 2: Build critical structures (like containers) if spawns are 100% full
            if (roomState.constructionSites) {
                let bestSite = null;
                let bestScore = -1;
                for (const siteId in roomState.constructionSites) {
                    const s = CacheLib.getById(siteId) || roomState.constructionSites[siteId];
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
}

module.exports = TaskAssignmentManager;