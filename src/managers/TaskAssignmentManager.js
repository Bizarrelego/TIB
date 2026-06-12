const ActionConstants = require('../constants/ActionConstants');
const CacheLib = require('../lib/CacheLib');
const MathLib = require('../lib/MathLib');
// Task assignment modules have been purged and merged natively.



/**
 * Top-Down, Heap-Driven Task Assignment Manager
 * Optimized for strict Drop-Mining, Stationary Upgrading, and Distance-Weighted Hauling.
 */
class TaskAssignmentManager {
    /**
     * Centralized cross-room routing helper.
     * Translates strategic targets into local waypoints for the TrafficManager.
     */
    static setMoveRoomIntent(creep, targetRoom) {
        creep.memory.targetRoom = targetRoom;
        creep.heap.actionIntent = ActionConstants.ACTION_MOVE_ROOM;
        
        let nextRoom = targetRoom;
        
        // 1. Expansion Routing Override
        if (Memory.empire && Memory.empire.colonizeRoom === targetRoom && Memory.empire.colonizeRoute) {
            const route = Memory.empire.colonizeRoute;
            const idx = route.indexOf(creep.room.name);
            if (idx > -1 && idx < route.length - 1) {
                nextRoom = route[idx + 1];
            }
        } 
        // 2. Universal Multi-Room Routing
        else {
            if (!creep.heap.route || creep.heap.routeTarget !== targetRoom) {
                const route = Game.map.findRoute(creep.room.name, targetRoom, {
                    routeCallback: (roomName) => {
                        const status = typeof Game.map.getRoomStatus === 'function' ? Game.map.getRoomStatus(roomName) : null;
                        if (status && (status.status === 'closed' || status.status === 'novice' || status.status === 'respawn')) return Infinity;
                        
                        const intel = Memory.rooms[roomName];
                        if (intel) {
                            if (intel.controller && intel.controller.owner && intel.controller.owner !== 'Bizarrelego') return 20;
                            if (intel.roomType === 'center' || intel.roomType === 'keeper') return 10;
                        }
                        return 1;
                    }
                });
                
                if (route !== ERR_NO_PATH && route.length > 0) {
                    creep.heap.route = route.map(r => r.room);
                    creep.heap.routeTarget = targetRoom;
                } else {
                    creep.heap.route = [];
                    creep.heap.routeTarget = targetRoom;
                }
            }
            
            if (creep.heap.route && creep.heap.route.length > 0) {
                nextRoom = creep.heap.route[0];
                // Advance the route when the creep enters the next room
                if (creep.room.name === nextRoom) {
                    creep.heap.route.shift();
                    if (creep.heap.route.length > 0) {
                        nextRoom = creep.heap.route[0];
                    } else {
                        nextRoom = targetRoom;
                    }
                }
            }
        }
        
        // Generate localized destination for the TrafficManager
        creep.heap.destination = { x: 25, y: 25, roomName: nextRoom, range: 22 };
    }

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

        if (creep.room.name !== creep.memory.colony && Memory.rooms[creep.room.name] && Memory.rooms[creep.room.name].undefendable > Game.time) {
            creep.memory.targetRoom = creep.memory.colony;
            creep.heap.fleeGoals = null;
            creep.heap.targetId = null;
            creep.heap.actionIntent = ActionConstants.ACTION_MOVE;
            TaskAssignmentManager.setMoveRoomIntent(creep, creep.memory.colony);
            return true;
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
        if (role === 'harvester') TaskAssignmentManager.assignHarvester(creep, roomState);
        else if (role === 'hauler') TaskAssignmentManager.assignHauler(creep, roomState);
        else if (role === 'builder') TaskAssignmentManager.assignBuilder(creep, roomState);
        else if (role === 'pioneer') TaskAssignmentManager.assignPioneer(creep, roomState);
        else if (role === 'bootstrapper') TaskAssignmentManager.assignBootstrapper(creep, roomState);
        else if (role === 'upgrader') TaskAssignmentManager.assignUpgrader(creep, roomState);
        else if (role === 'filler') TaskAssignmentManager.assignFiller(creep, roomState);
        else if (role === 'fastfiller') TaskAssignmentManager.assignFastfiller(creep, roomState);
        else if (role === 'remoteharvester') TaskAssignmentManager.assignRemoteHarvester(creep, roomState);
        else if (role === 'remotehauler') TaskAssignmentManager.assignRemoteHauler(creep, roomState);
        else if (role === 'reserver') TaskAssignmentManager.assignReserver(creep, roomState);
        else if (role === 'defender') TaskAssignmentManager.assignDefender(creep, roomState);
        else if (role === 'hubmanager') TaskAssignmentManager.assignHubManager(creep, roomState);
        else if (role === 'mineralminer') TaskAssignmentManager.assignMineralMiner(creep, roomState);
        else if (role === 'mineralhauler') TaskAssignmentManager.assignMineralHauler(creep, roomState);
        else if (role === 'claimer') TaskAssignmentManager.assignClaimer(creep, roomState);
        else if (role === 'scientist') TaskAssignmentManager.assignScientist(creep, roomState);
        else if (role === 'remotebuilder') TaskAssignmentManager.assignRemoteBuilder(creep, roomState);
        else if (role === 'skguard') TaskAssignmentManager.assignSKGuard(creep, roomState);
        else if (role === 'skminer') TaskAssignmentManager.assignSKMiner(creep, roomState);
        else if (role === 'skhauler') TaskAssignmentManager.assignSKHauler(creep, roomState);
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
            TaskAssignmentManager.setMoveRoomIntent(creep, creep.memory.targetRoom);
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

        // Science Logistics Variables
        const scienceTarget = Memory.rooms[creep.memory.colony]?.scienceTarget;
        let supplierLabs = [];
        let reactorLabs = [];
        if (scienceTarget && roomState.labs && roomState.labs.length >= 3) {
            const blueprint = global.Cache.blueprints?.get(creep.room.name);
            if (blueprint && blueprint.supplierLabs) {
                for (let i = 0; i < roomState.labs.length; i++) {
                    const lab = roomState.labs[i];
                    let isSupplier = false;
                    for (let j = 0; j < blueprint.supplierLabs.length; j++) {
                        const sup = blueprint.supplierLabs[j];
                        if (lab.pos.x === sup.x && lab.pos.y === sup.y) {
                            supplierLabs.push(lab);
                            isSupplier = true;
                            break;
                        }
                    }
                    if (!isSupplier) reactorLabs.push(lab);
                }
            }
        }

        if (creep.heap.state === 'gather') {
            // Priority 1: Extract synthesized compounds from Reactor Labs
            if (scienceTarget && reactorLabs.length > 0) {
                for (let i = 0; i < reactorLabs.length; i++) {
                    const reactor = reactorLabs[i];
                    if (reactor.store.getUsedCapacity(scienceTarget.target) >= 100) {
                        creep.heap.targetId = reactor.id;
                        creep.heap.actionIntent = ActionConstants.ACTION_WITHDRAW;
                        // HACK: Store what we are grabbing so ActionExecutor pulls the right mineral
                        creep.memory.withdrawResource = scienceTarget.target;
                        return;
                    }
                }
            }

            // Priority 2: Load Supplier Labs with raw reactant minerals
            if (scienceTarget && supplierLabs.length === 2) {
                const sup1 = supplierLabs[0];
                const sup2 = supplierLabs[1];

                if (sup1.store.getUsedCapacity(scienceTarget.r1) < 1000 && terminal.store.getUsedCapacity(scienceTarget.r1) > 0) {
                    creep.heap.targetId = terminal.id;
                    creep.heap.actionIntent = ActionConstants.ACTION_WITHDRAW;
                    creep.memory.withdrawResource = scienceTarget.r1;
                    return;
                }
                if (sup2.store.getUsedCapacity(scienceTarget.r2) < 1000 && terminal.store.getUsedCapacity(scienceTarget.r2) > 0) {
                    creep.heap.targetId = terminal.id;
                    creep.heap.actionIntent = ActionConstants.ACTION_WITHDRAW;
                    creep.memory.withdrawResource = scienceTarget.r2;
                    return;
                }
            }

            // Reset HACK if doing normal operations
            creep.memory.withdrawResource = null;

            // Priority 3: Empty Hub Link
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
            // Work phase (we are holding energy or minerals)
            const carriedTypes = Object.keys(creep.store).filter(r => creep.store[r] > 0);
            const carriedType = carriedTypes.length > 0 ? carriedTypes[0] : RESOURCE_ENERGY;

            // Priority 1: Lab Logistics (Transferring minerals)
            if (scienceTarget && carriedType !== RESOURCE_ENERGY) {
                if (carriedType === scienceTarget.target) {
                    // Dump product into terminal
                    creep.heap.targetId = terminal.id;
                    creep.heap.actionIntent = ActionConstants.ACTION_TRANSFER;
                    return;
                } else if (carriedType === scienceTarget.r1 && supplierLabs.length === 2) {
                    creep.heap.targetId = supplierLabs[0].id;
                    creep.heap.actionIntent = ActionConstants.ACTION_TRANSFER;
                    return;
                } else if (carriedType === scienceTarget.r2 && supplierLabs.length === 2) {
                    creep.heap.targetId = supplierLabs[1].id;
                    creep.heap.actionIntent = ActionConstants.ACTION_TRANSFER;
                    return;
                }
                
                // If we are holding random garbage minerals, dump to terminal
                creep.heap.targetId = terminal.id;
                creep.heap.actionIntent = ActionConstants.ACTION_TRANSFER;
                return;
            }

            // Priority 2: Fill Terminal if we withdrew from Storage due to overflow
            if (carriedType === RESOURCE_ENERGY && storage.store.getUsedCapacity(RESOURCE_ENERGY) > 500000 && terminal.store.getFreeCapacity() > 0) {
                creep.heap.targetId = terminal.id;
                creep.heap.actionIntent = ActionConstants.ACTION_TRANSFER;
                return;
            }

            // Priority 3: Dump everything else into Storage
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
            TaskAssignmentManager.setMoveRoomIntent(creep, creep.memory.targetRoom);
            return;
        }

        const targetRoomState = global.State?.rooms?.get(creep.room.name);
        if (targetRoomState && targetRoomState.controller) {
            creep.heap.targetId = targetRoomState.controller.id;
            
            const myUsername = Memory.empire ? Memory.empire.username : 'Bizarrelego';
            const reservation = targetRoomState.controller.reservation;
            
            if (reservation && reservation.username !== myUsername) {
                creep.heap.actionIntent = ActionConstants.ACTION_ATTACK_CONTROLLER;
            } else {
                creep.heap.actionIntent = ActionConstants.ACTION_CLAIM;
            }
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
                TaskAssignmentManager.setMoveRoomIntent(creep, creep.memory.targetRoom);
                return;
            }
            creep.heap.targetId = homeState.hostiles[0].id;
            creep.heap.actionIntent = ActionConstants.ACTION_ATTACK;
            return;
        }

        // Priority 2: Defend expansion room
        if (Memory.empire && Memory.empire.colonizeRoom && Memory.empire.colonizeSourceColony === creep.memory.colony) {
            const expState = global.State.rooms.get(Memory.empire.colonizeRoom);
            if (expState && expState.hostiles && expState.hostileCount > 0) {
                if (creep.room.name !== Memory.empire.colonizeRoom) {
                    creep.memory.targetRoom = Memory.empire.colonizeRoom;
                    TaskAssignmentManager.setMoveRoomIntent(creep, creep.memory.targetRoom);
                    return;
                }
                creep.heap.targetId = expState.hostiles[0].id;
                creep.heap.actionIntent = ActionConstants.ACTION_ATTACK;
                return;
            }
        }

        // Priority 3: Defend outposts
        const outposts = Memory.rooms[creep.memory.colony]?.outposts || [];
        for (let i = 0; i < outposts.length; i++) {
            const outpostState = global.State.rooms.get(outposts[i]);
            if (outpostState && outpostState.hostiles && outpostState.hostileCount > 0) {
                if (creep.room.name !== outposts[i]) {
                    creep.memory.targetRoom = outposts[i];
                    TaskAssignmentManager.setMoveRoomIntent(creep, creep.memory.targetRoom);
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
        if (!creep.memory.targetRoom || !creep.memory.targetSource) {
            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
            return;
        }

        if (creep.room.name !== creep.memory.targetRoom) {
            TaskAssignmentManager.setMoveRoomIntent(creep, creep.memory.targetRoom);
            return;
        }

        const roomState = global.State?.rooms?.get(creep.room.name);
        if (!roomState) return;

        TaskAssignmentManager.assignHarvester(creep, roomState);
    }

    static assignReserver(creep, _roomState) {
        if (!creep.memory.targetRoom) {
            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
            return;
        }

        if (creep.room.name !== creep.memory.targetRoom) {
            TaskAssignmentManager.setMoveRoomIntent(creep, creep.memory.targetRoom);
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

    static assignRemoteBuilder(creep, homeState) {
        if (!creep.memory.targetRoom) {
            const outposts = Memory.rooms[creep.memory.colony]?.outposts || [];
            if (outposts.length > 0) {
                const census = TaskAssignmentManager.getRemoteCensus();
                let bestRoom = outposts[0];
                let minCount = Infinity;
                for (let i = 0; i < outposts.length; i++) {
                    const key = `remotebuilder_${creep.memory.colony}_${outposts[i]}`;
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

        if (creep.heap.state === 'gather') {
            if (creep.room.name !== creep.memory.colony) {
                creep.memory.targetRoom = creep.memory.colony; // Temporary override for gather
                TaskAssignmentManager.setMoveRoomIntent(creep, creep.memory.targetRoom);
                return;
            }
            if (TaskAssignmentManager.getEnergy(creep, homeState, false)) return;
            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
            return;
        }

        // State: work
        if (creep.room.name !== creep.memory.targetRoom) {
            TaskAssignmentManager.setMoveRoomIntent(creep, creep.memory.targetRoom);
            return;
        }

        const roomState = global.State?.rooms?.get(creep.room.name);
        if (!roomState) return;

        // Repair containers and roads
        if (roomState.repairTargets?.length > 0) {
            for (let i = 0; i < roomState.repairTargetCount; i++) {
                const target = roomState.repairTargets[i];
                if (target.hits < target.hitsMax * 0.5) {
                    creep.heap.targetId = target.id;
                    creep.heap.actionIntent = ActionConstants.ACTION_REPAIR;
                    return;
                }
            }
        }

        // Build sites
        if (roomState.constructionSites && roomState.constructionSiteCount > 0) {
            creep.heap.targetId = roomState.constructionSites[0].id;
            creep.heap.actionIntent = ActionConstants.ACTION_BUILD;
            return;
        }

        creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
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

            // --- Tigga-Style Infrastructure Maintenance ---
            creep.heap.opportunisticTarget = null;
            if (creep.getActiveBodyparts(WORK) > 0 && creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                const structures = creep.pos.lookFor(LOOK_STRUCTURES);
                for (let i = 0; i < structures.length; i++) {
                    const s = structures[i];
                    if (s.structureType === STRUCTURE_ROAD && s.hits < s.hitsMax - 1000) {
                        creep.heap.opportunisticTarget = s.id;
                        break;
                    }
                }
            }

            if (creep.room.name !== creep.memory.targetRoom) {
                TaskAssignmentManager.setMoveRoomIntent(creep, creep.memory.targetRoom);
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
                // --- Tigga-Style Infrastructure Maintenance ---
                creep.heap.opportunisticTarget = null;
                if (creep.getActiveBodyparts(WORK) > 0 && creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                    const structures = creep.pos.lookFor(LOOK_STRUCTURES);
                    for (let i = 0; i < structures.length; i++) {
                        const s = structures[i];
                        if (s.structureType === STRUCTURE_ROAD && s.hits < s.hitsMax - 1000) {
                            creep.heap.opportunisticTarget = s.id;
                            break;
                        }
                    }
                }

                creep.memory.targetRoom = creep.memory.colony;
                TaskAssignmentManager.setMoveRoomIntent(creep, creep.memory.targetRoom);
                return;
            }
            TaskAssignmentManager.assignHaulerWork(creep, homeState);
        }
    }

    static assignSKHauler(creep, _roomState) {
        // Functions identically to remote hauler, but targets SK rooms explicitly.
        const homeState = global.State?.rooms?.get(creep.memory.colony);
        if (!homeState) return;

        if (creep.heap.state === 'gather') {
            if (!creep.memory.targetRoom) {
                const outposts = Memory.rooms[creep.memory.colony]?.outposts || [];
                if (outposts.length > 0) {
                    const census = TaskAssignmentManager.getRemoteCensus();
                    let bestRoom = outposts[0];
                    let minCount = Infinity;
                    for (let i = 0; i < outposts.length; i++) {
                        // Only target SK outposts
                        if (Memory.rooms[outposts[i]]?.roomType !== 'sk') continue;
                        
                        const key = `skhauler_${creep.memory.colony}_${outposts[i]}`;
                        const count = census.get(key) || 0;
                        if (count < minCount) {
                            minCount = count;
                            bestRoom = outposts[i];
                        }
                    }
                    if (minCount !== Infinity) {
                        creep.memory.targetRoom = bestRoom;
                    } else {
                        return; // No SK outposts
                    }
                } else {
                    return;
                }
            }
            if (creep.room.name !== creep.memory.targetRoom) {
                TaskAssignmentManager.setMoveRoomIntent(creep, creep.memory.targetRoom);
                return;
            }
            const localState = global.State?.rooms?.get(creep.room.name);
            if (!localState) return;

            // Priority: Assigned Target Source
            if (creep.memory.targetSource) {
                const result = TaskAssignmentManager.getEnergyNearSource(creep, creep.memory.targetSource, localState);
                if (result) {
                    creep.heap.targetId = result.target.id;
                    creep.heap.actionIntent = result.intent;
                    return;
                }
            }

            let bestTarget = null;
            let bestAmount = 0;
            const drops = localState.droppedEnergy || [];
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
                TaskAssignmentManager.setMoveRoomIntent(creep, creep.memory.targetRoom);
                return;
            }
            TaskAssignmentManager.assignHaulerWork(creep, homeState);
        }
    }

    static assignFastfiller(creep, roomState) {
        const blueprint = global.Cache?.blueprints?.get(creep.room.name);
        if (!blueprint || !blueprint.anchor) {
            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
            return;
        }
        const ax = blueprint.anchor.x;
        const ay = blueprint.anchor.y;
        
        // 1. Calculate designated parking spot
        if (!creep.memory.spotX) {
            const spots = [
                {x: ax - 1, y: ay - 1}, 
                {x: ax + 1, y: ay - 1}, 
                {x: ax - 1, y: ay + 1}, 
                {x: ax + 1, y: ay + 1}
            ];
            for (let i = 0; i < spots.length; i++) {
                const s = spots[i];
                let occupied = false;
                for (const name in Game.creeps) {
                    const c = Game.creeps[name];
                    if (c.memory.role === 'fastfiller' && c.name !== creep.name) {
                        if (c.memory.spotX === s.x && c.memory.spotY === s.y) occupied = true;
                    }
                }
                if (!occupied) {
                    creep.memory.spotX = s.x;
                    creep.memory.spotY = s.y;
                    break;
                }
            }
        }
        
        const spotX = creep.memory.spotX;
        const spotY = creep.memory.spotY;
        if (!spotX) {
            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
            return;
        }
        
        // 2. Navigate to parking spot exactly once
        if (creep.pos.x !== spotX || creep.pos.y !== spotY) {
            creep.heap.destination = { x: spotX, y: spotY, roomName: creep.room.name, range: 0 };
            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
            return;
        }
        
        // 3. Static Execution Loop
        let targetNeedsEnergy = null;
        
        const checkStructure = (s) => {
            if (s && Math.max(Math.abs(s.pos.x - spotX), Math.abs(s.pos.y - spotY)) <= 1) {
                if (s.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                    targetNeedsEnergy = s;
                    return true;
                }
            }
            return false;
        };
        
        for (let i = 0; i < roomState.spawnCount; i++) if (checkStructure(roomState.spawns[i])) break;
        if (!targetNeedsEnergy) {
            for (let i = 0; i < roomState.extensionCount; i++) if (checkStructure(roomState.extensions[i])) break;
        }
        
        if (targetNeedsEnergy) {
            if (creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                creep.heap.targetId = targetNeedsEnergy.id;
                creep.heap.actionIntent = ActionConstants.ACTION_TRANSFER;
            } else {
                let source = null;
                // Withdraw from adjacent Link, Storage, or Core Containers
                if (roomState.links) {
                    for (let i = 0; i < roomState.linkCount; i++) {
                        const l = roomState.links[i];
                        if (Math.max(Math.abs(l.pos.x - spotX), Math.abs(l.pos.y - spotY)) <= 1 && l.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                            source = l; break;
                        }
                    }
                }
                if (!source && roomState.storage && Math.max(Math.abs(roomState.storage.pos.x - spotX), Math.abs(roomState.storage.pos.y - spotY)) <= 1) {
                    if (roomState.storage.store.getUsedCapacity(RESOURCE_ENERGY) > 0) source = roomState.storage;
                }
                if (!source && roomState.coreContainers) {
                    for (let i = 0; i < roomState.coreContainerCount; i++) {
                        const c = roomState.coreContainers[i];
                        if (c && Math.max(Math.abs(c.pos.x - spotX), Math.abs(c.pos.y - spotY)) <= 1 && c.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                            source = c; break;
                        }
                    }
                }
                
                if (source) {
                    creep.heap.targetId = source.id;
                    creep.heap.actionIntent = ActionConstants.ACTION_WITHDRAW;
                } else {
                    creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
                }
            }
        } else {
            // Buffer empty capacity if there's nothing to fill
            if (creep.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                 let source = null;
                 if (roomState.coreContainers) {
                     for (let i = 0; i < roomState.coreContainerCount; i++) {
                         const c = roomState.coreContainers[i];
                         if (c && Math.max(Math.abs(c.pos.x - spotX), Math.abs(c.pos.y - spotY)) <= 1 && c.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                             source = c; break;
                         }
                     }
                 }
                 if (source) {
                     creep.heap.targetId = source.id;
                     creep.heap.actionIntent = ActionConstants.ACTION_WITHDRAW;
                     return;
                 }
            }
            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
        }
    }

    static assignFiller(creep, roomState) {
        if (creep.heap.state === 'gather') {
            // Priority 0: Handle non-energy cargo first
            if (creep.store.getUsedCapacity() > creep.store.getUsedCapacity(RESOURCE_ENERGY)) {
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
            }

            // Priority 0.5: Dropped energy (>50), Tombstones, Ruins
            const scavenge = TaskAssignmentManager.findClosestEnergy(creep, roomState);
            if (scavenge) {
                creep.heap.targetId = scavenge.id;
                creep.heap.actionIntent = scavenge.actionIntent;
                return;
            }

            // Priority 1: Terminal excess (>60,000)
            if (roomState.terminal && roomState.terminal.store.getUsedCapacity(RESOURCE_ENERGY) > 60000) {
                creep.heap.targetId = roomState.terminal.id;
                creep.heap.actionIntent = ActionConstants.ACTION_WITHDRAW;
                return;
            }

            // Priority 2: Containers
            if (roomState.controllerContainers && roomState.controllerContainers.length > 0) {
                for (let i = 0; i < roomState.controllerContainers.length; i++) {
                    const c = roomState.controllerContainers[i];
                    if (c.store.getUsedCapacity(RESOURCE_ENERGY) > 500) {
                        creep.heap.targetId = c.id;
                        creep.heap.actionIntent = ActionConstants.ACTION_WITHDRAW;
                        return;
                    }
                }
            }

            // Priority 3: Storage
            if (roomState.storage && roomState.storage.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                creep.heap.targetId = roomState.storage.id;
                creep.heap.actionIntent = ActionConstants.ACTION_WITHDRAW;
                return;
            }

            // Priority 4: Terminal Fallback
            if (roomState.terminal && roomState.terminal.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                creep.heap.targetId = roomState.terminal.id;
                creep.heap.actionIntent = ActionConstants.ACTION_WITHDRAW;
                return;
            }

            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
        } else {
            // Priority 0: Critical Towers (< 600 energy)
            if (roomState.towers) {
                let criticalTower = null;
                for (let i = 0; i < roomState.towerCount; i++) {
                    const t = roomState.towers[i];
                    if (t.store.getUsedCapacity(RESOURCE_ENERGY) < 600) {
                        criticalTower = t;
                        break;
                    }
                }
                if (criticalTower) {
                    creep.heap.targetId = criticalTower.id;
                    creep.heap.actionIntent = ActionConstants.ACTION_TRANSFER;
                    return;
                }
            }

            // Priority 1 & 2: Spawns/Extensions, followed by Towers (>200 missing)
            if (TaskAssignmentManager.routeToCoreStructures(creep, roomState, true)) return;

            // Priority 3: Labs
            if (roomState.labs && roomState.labCount > 0) {
                for (let i = 0; i < roomState.labCount; i++) {
                    const l = roomState.labs[i];
                    if (l.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                        creep.heap.targetId = l.id;
                        creep.heap.actionIntent = ActionConstants.ACTION_TRANSFER;
                        return;
                    }
                }
            }

            // Priority 4: Nuker
            if (roomState.nuker && roomState.storage && roomState.storage.store.getUsedCapacity(RESOURCE_ENERGY) > 150000) {
                if (roomState.nuker.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                    creep.heap.targetId = roomState.nuker.id;
                    creep.heap.actionIntent = ActionConstants.ACTION_TRANSFER;
                    return;
                }
            }

            // Priority 5: Balancing Terminal/Storage
            if (roomState.terminal && roomState.terminal.store.getFreeCapacity(RESOURCE_ENERGY) > 0 && roomState.terminal.store.getUsedCapacity(RESOURCE_ENERGY) < 50000) {
                if (roomState.storage && roomState.storage.store.getUsedCapacity(RESOURCE_ENERGY) > 10000) {
                    creep.heap.targetId = roomState.terminal.id;
                    creep.heap.actionIntent = ActionConstants.ACTION_TRANSFER;
                    return;
                }
            }

            // Priority 6: Storage Dump
            if (roomState.storage && roomState.storage.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                creep.heap.targetId = roomState.storage.id;
                creep.heap.actionIntent = ActionConstants.ACTION_TRANSFER;
                return;
            }

            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
        }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // NATIVE TASK MODULES
    // ─────────────────────────────────────────────────────────────────────────────

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

        creep.heap.targetId = creep.memory.targetId;
        creep.heap.actionIntent = ActionConstants.ACTION_HARVEST;

        const source = CacheLib.getById(creep.memory.targetId);
        if (!source) return;

        if (roomState.sourceContainers) {
            for (let i = 0; i < roomState.sourceContainers.length; i++) {
                const c = roomState.sourceContainers[i];
                if (Math.max(Math.abs(c.pos.x - source.pos.x), Math.abs(c.pos.y - source.pos.y)) <= 2) {
                    creep.heap.sitTargetId = c.id;
                    break;
                }
            }
        }

        if (creep.heap.sitTargetId) {
            const container = CacheLib.getById(creep.heap.sitTargetId);
            if (container && (creep.pos.x !== container.pos.x || creep.pos.y !== container.pos.y || creep.pos.roomName !== container.pos.roomName)) {
                creep.heap.destination = { x: container.pos.x, y: container.pos.y, roomName: container.pos.roomName, range: 0 };
                creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
            }
        }
    }

    static routeToCoreStructures(creep, roomState, includeTowers = true) {
        let bestTarget = null;
        let bestScore = -1;

        const evaluateTarget = (target) => {
            if (!target || !target.store) return;
            if (target.isActive !== undefined && !target.isActive()) return;

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

        // Pass 1: Spawns and Extensions (Absolute Core Priority)
        roomState.spawns?.forEach(evaluateTarget);
        roomState.extensions?.forEach(evaluateTarget);

        if (bestTarget) {
            bestTarget.__deliveryClaimed = (bestTarget.__deliveryClaimed || 0) + creep.store.getUsedCapacity(RESOURCE_ENERGY);
            creep.heap.targetId = bestTarget.id;
            creep.heap.actionIntent = ActionConstants.ACTION_TRANSFER;
            return true;
        }
        
        // Pass 2: Towers (Secondary Core Priority)
        if (includeTowers) {
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
        }

        return false;
    }

    static assignUpgrader(creep, roomState) {
        if (!roomState.controller) return;

        // Find the planned container tile
        const blueprint = global.Cache?.blueprints?.get(creep.room.name);
        let containerTile = null;
        if (blueprint && blueprint.containers) {
            for (let i = 0; i < blueprint.containers.length; i++) {
                const tile = blueprint.containers[i];
                if (Math.abs(tile.x - roomState.controller.pos.x) <= 3 && Math.abs(tile.y - roomState.controller.pos.y) <= 3) {
                    containerTile = tile;
                    break;
                }
            }
        }

        const focusPos = containerTile ? { x: containerTile.x, y: containerTile.y, roomName: creep.room.name } : roomState.controller.pos;
        const focusRange = containerTile ? 1 : 3;

        // Fixes upgrader spawn paralysis by enforcing strict physical routing to the controller hub before attempting to execute work intents.
        if (Math.max(Math.abs(creep.pos.x - focusPos.x), Math.abs(creep.pos.y - focusPos.y)) > focusRange) {
            creep.heap.destination = { x: focusPos.x, y: focusPos.y, roomName: focusPos.roomName, range: focusRange };
            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
            return;
        }

        // Opportunistic Pickup: If energy is dropped perfectly adjacent, snatch it while upgrading!
        if (creep.store.getFreeCapacity(RESOURCE_ENERGY) > 0 && roomState.droppedEnergy && roomState.droppedEnergy.length > 0) {
            let found = false;
            for (let i = 0; i < roomState.droppedEnergy.length; i++) {
                const d = roomState.droppedEnergy[i];
                if (Math.max(Math.abs(creep.pos.x - d.pos.x), Math.abs(creep.pos.y - d.pos.y)) <= 1) {
                    creep.heap.secondaryTargetId = d.id;
                    creep.heap.secondaryIntent = ActionConstants.ACTION_PICKUP;
                    found = true;
                    break;
                }
            }
            if (!found) {
                creep.heap.secondaryTargetId = null;
                creep.heap.secondaryIntent = null;
            }
        } else {
            creep.heap.secondaryTargetId = null;
            creep.heap.secondaryIntent = null;
        }

        // If the upgrader needs energy, issue a gather intent first
        if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
            // Priority 0: Withdraw from adjacent link
            if (roomState.links) {
                for (let i = 0; i < roomState.links.length; i++) {
                    const link = roomState.links[i];
                    if (Math.max(Math.abs(link.pos.x - creep.pos.x), Math.abs(link.pos.y - creep.pos.y)) <= 1 && link.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
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

        // Emergency Base Relocation Protocol: If there are no spawns, but a spawn construction site exists, Upgraders become Builders
        if ((!roomState.spawns || roomState.spawns.length === 0) && roomState.constructionSites) {
            const sites = Object.values(roomState.constructionSites);
            for (let i = 0; i < sites.length; i++) {
                if (sites[i].structureType === STRUCTURE_SPAWN) {
                    creep.heap.targetId = sites[i].id;
                    creep.heap.actionIntent = ActionConstants.ACTION_BUILD;
                    return;
                }
            }
        }

        // Issue upgrade intent
        creep.heap.targetId = roomState.controller.id;
        creep.heap.actionIntent = ActionConstants.ACTION_UPGRADE;
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
        // IMPORTANT: Bootstrappers are strictly forbidden from withdrawing from spawns to prevent infinite withdraw/transfer loops.
        if (roomState.spawns && creep.memory.role !== 'bootstrapper') {
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

        // Check Storage
        if (roomState.storage && roomState.storage.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
            const dx = Math.abs(creep.pos.x - roomState.storage.pos.x);
            const dy = Math.abs(creep.pos.y - roomState.storage.pos.y);
            const dist = Math.max(dx, dy);
            if (dist < bestDist) {
                bestDist = dist;
                bestTarget = roomState.storage;
                bestIntent = ActionConstants.ACTION_WITHDRAW;
            }
        }

        // Check Terminal
        if (roomState.terminal && roomState.terminal.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
            const dx = Math.abs(creep.pos.x - roomState.terminal.pos.x);
            const dy = Math.abs(creep.pos.y - roomState.terminal.pos.y);
            const dist = Math.max(dx, dy);
            if (dist < bestDist) {
                bestDist = dist;
                bestTarget = roomState.terminal;
                bestIntent = ActionConstants.ACTION_WITHDRAW;
            }
        }

        if (bestTarget) {
            bestTarget.__gatherClaimed = (bestTarget.__gatherClaimed || 0) + creep.store.getFreeCapacity(RESOURCE_ENERGY);
            return { id: bestTarget.id, actionIntent: bestIntent };
        }
        return null;
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

        const fastfillerCount = (roomState.creepCounts && roomState.creepCounts['fastfiller']) ? roomState.creepCounts['fastfiller'] : 0;
        const fillerCount = (roomState.creepCounts && roomState.creepCounts['filler']) ? roomState.creepCounts['filler'] : 0;
        const hasActiveFiller = fastfillerCount > 0 || fillerCount > 0;
        
        const hasCoreContainer = roomState.coreContainers && roomState.coreContainerCount > 0;
        const hasStorage = roomState.storage && roomState.storage.store.getFreeCapacity() > 0;
        const hasCentralDropoff = hasCoreContainer || hasStorage;

        // Dynamic Logistics Fallback
        if (!hasActiveFiller || !hasCentralDropoff) {
            if (TaskAssignmentManager.routeToCoreStructures(creep, roomState)) return;
        }

        // Pre-Storage Controller Delivery (RCL < 6 or no link)
        if (roomState.controller) {
            let controllerLink = null;
            if (roomState.links) {
                for (let i = 0; i < roomState.links.length; i++) {
                    if (Math.max(Math.abs(roomState.links[i].pos.x - roomState.controller.pos.x), Math.abs(roomState.links[i].pos.y - roomState.controller.pos.y)) <= 3) {
                        controllerLink = roomState.links[i];
                        break;
                    }
                }
            }

            if (!controllerLink) {
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
                    if (controllerContainer.store.getUsedCapacity(RESOURCE_ENERGY) < 1500) {
                        creep.heap.targetId = controllerContainer.id;
                        creep.heap.actionIntent = ActionConstants.ACTION_TRANSFER;
                        return;
                    }
                } else {
                    let droppedEnergyAmount = 0;
                    if (roomState.droppedEnergy) {
                        for (let i = 0; i < roomState.droppedEnergy.length; i++) {
                            const d = roomState.droppedEnergy[i];
                            if (Math.max(Math.abs(d.pos.x - roomState.controller.pos.x), Math.abs(d.pos.y - roomState.controller.pos.y)) <= 3) {
                                droppedEnergyAmount += d.amount;
                            }
                        }
                    }
                    if (droppedEnergyAmount < 1000) {
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
                            if (distToTile > 1) {
                                creep.heap.destination = { x: plannedContainerTile.x, y: plannedContainerTile.y, roomName: creep.room.name, range: 1 };
                                creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
                                return;
                            } else {
                                creep.heap.targetId = roomState.controller.id;
                                creep.heap.actionIntent = ActionConstants.ACTION_DROP;
                                return;
                            }
                        } else {
                            if (Math.max(Math.abs(creep.pos.x - roomState.controller.pos.x), Math.abs(creep.pos.y - roomState.controller.pos.y)) > 3) {
                                creep.heap.destination = { x: roomState.controller.pos.x, y: roomState.controller.pos.y, roomName: creep.room.name, range: 3 };
                                creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
                                return;
                            } else {
                                creep.heap.targetId = roomState.controller.id;
                                creep.heap.actionIntent = ActionConstants.ACTION_DROP;
                                return;
                            }
                        }
                    }
                }
            }
        }

        // Priority 1: Dump in Storage if it exists
        if (roomState.storage && roomState.storage.store.getFreeCapacity() > 0) {
            creep.heap.targetId = roomState.storage.id;
            creep.heap.actionIntent = ActionConstants.ACTION_TRANSFER;
            return;
        }
        
        // Priority 1b: Dump in Core Containers if fastfillers are active
        if (roomState.coreContainers && roomState.coreContainerCount > 0) {
            let bestCore = null;
            let bestFree = 0;
            for (let i = 0; i < roomState.coreContainerCount; i++) {
                const c = roomState.coreContainers[i];
                if (c && c.store.getFreeCapacity() > bestFree) {
                    bestFree = c.store.getFreeCapacity();
                    bestCore = c;
                }
            }
            if (bestCore) {
                creep.heap.targetId = bestCore.id;
                creep.heap.actionIntent = ActionConstants.ACTION_TRANSFER;
                return;
            }
        }

        // (Removed duplicate routeToCoreStructures check since it's handled by the Dynamic Logistics Fallback at Priority 1)

        // If Storage is full, we should still drop at controller if needed as a last resort.
        if (roomState.controller && roomState.storage && roomState.storage.store.getFreeCapacity() === 0) {
            creep.heap.targetId = roomState.controller.id;
            creep.heap.actionIntent = ActionConstants.ACTION_DROP;
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

    static assignSKGuard(creep, roomState) {
        if (!creep.memory.targetRoom) {
            const outposts = Memory.rooms[creep.memory.colony]?.outposts || [];
            if (outposts.length > 0) {
                const census = TaskAssignmentManager.getRemoteCensus();
                let bestRoom = outposts[0];
                let minCount = Infinity;
                for (let i = 0; i < outposts.length; i++) {
                    if (Memory.rooms[outposts[i]]?.roomType !== 'sk') continue;
                    const key = `skguard_${creep.memory.colony}_${outposts[i]}`;
                    const count = census.get(key) || 0;
                    if (count < minCount) {
                        minCount = count;
                        bestRoom = outposts[i];
                    }
                }
                if (minCount !== Infinity) creep.memory.targetRoom = bestRoom;
                else return;
            } else return;
        }

        if (creep.room.name !== creep.memory.targetRoom) {
            TaskAssignmentManager.setMoveRoomIntent(creep, creep.memory.targetRoom);
            // Pre-heal while moving if damaged
            if (creep.hits < creep.hitsMax) creep.heap.secondaryIntent = ActionConstants.ACTION_HEAL;
            return;
        }

        // Inside the SK room
        if (creep.hits < creep.hitsMax) {
            creep.heap.secondaryIntent = ActionConstants.ACTION_HEAL; // self heal
        }

        // Priority 1: Hostiles (Invaders or actual players)
        if (roomState.hostiles && roomState.hostiles.length > 0) {
            let bestHostile = null;
            let bestDist = Infinity;
            for (let i = 0; i < roomState.hostiles.length; i++) {
                const h = roomState.hostiles[i];
                if (h.owner.username === 'Source Keeper') continue; // Prioritize real hostiles
                const dist = Math.max(Math.abs(creep.pos.x - h.pos.x), Math.abs(creep.pos.y - h.pos.y));
                if (dist < bestDist) {
                    bestDist = dist;
                    bestHostile = h;
                }
            }
            if (bestHostile) {
                creep.heap.targetId = bestHostile.id;
                creep.heap.actionIntent = ActionConstants.ACTION_ATTACK;
                return;
            }
        }

        // Priority 2: Source Keepers
        if (roomState.hostiles && roomState.hostiles.length > 0) {
            let bestKeeper = null;
            let bestDist = Infinity;
            for (let i = 0; i < roomState.hostiles.length; i++) {
                const h = roomState.hostiles[i];
                if (h.owner.username !== 'Source Keeper') continue;
                const dist = Math.max(Math.abs(creep.pos.x - h.pos.x), Math.abs(creep.pos.y - h.pos.y));
                if (dist < bestDist) {
                    bestDist = dist;
                    bestKeeper = h;
                }
            }
            if (bestKeeper) {
                creep.heap.targetId = bestKeeper.id;
                creep.heap.actionIntent = ActionConstants.ACTION_ATTACK;
                return;
            }
        }

        // Priority 3: Wait near the soonest-to-spawn Lair
        const lairs = roomState.keeperLairs || [];
        if (lairs.length > 0) {
            let soonestLair = lairs[0];
            for (let i = 1; i < lairs.length; i++) {
                if (lairs[i].ticksToSpawn < soonestLair.ticksToSpawn) {
                    soonestLair = lairs[i];
                }
            }
            creep.heap.destination = { x: soonestLair.pos.x, y: soonestLair.pos.y, roomName: creep.room.name, range: 1 };
            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
        } else {
            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
        }
    }

    static assignSKMiner(creep, roomState) {
        if (!creep.memory.targetRoom) {
            const outposts = Memory.rooms[creep.memory.colony]?.outposts || [];
            if (outposts.length > 0) {
                const census = TaskAssignmentManager.getRemoteCensus();
                let bestRoom = outposts[0];
                let minCount = Infinity;
                for (let i = 0; i < outposts.length; i++) {
                    if (Memory.rooms[outposts[i]]?.roomType !== 'sk') continue;
                    const key = `skminer_${creep.memory.colony}_${outposts[i]}`;
                    const count = census.get(key) || 0;
                    if (count < minCount) {
                        minCount = count;
                        bestRoom = outposts[i];
                    }
                }
                if (minCount !== Infinity) creep.memory.targetRoom = bestRoom;
                else return;
            } else return;
        }

        if (creep.room.name !== creep.memory.targetRoom) {
            TaskAssignmentManager.setMoveRoomIntent(creep, creep.memory.targetRoom);
            return;
        }

        if (!creep.memory.targetSource) {
            const sources = roomState.sources;
            if (sources && sources.length > 0) {
                const sourceIds = sources.map(s => s.id);
                const assigned = TaskAssignmentManager.getAssignedSources('skminer', creep.room.name);
                let bestSource = sourceIds[0];
                let minAssigned = Infinity;

                for (let i = 0; i < sourceIds.length; i++) {
                    const count = assigned.get(sourceIds[i]) || 0;
                    if (count < minAssigned) {
                        minAssigned = count;
                        bestSource = sourceIds[i];
                    }
                }
                creep.memory.targetSource = bestSource;
            }
        }

        if (creep.memory.targetSource) {
            creep.heap.targetId = creep.memory.targetSource;
            creep.heap.actionIntent = ActionConstants.ACTION_HARVEST;
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
            const bestSource = TaskAssignmentManager.findClosestEnergy(creep, roomState);
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
            // Priority 1: Controller Emergency
            if (roomState.controller && roomState.controller.my && roomState.controller.ticksToDowngrade < 2000) {
                creep.heap.targetId = roomState.controller.id;
                creep.heap.actionIntent = ActionConstants.ACTION_UPGRADE;
                return;
            }

            // Priority 2: Fill Spawns/Extensions first to get real creeps spawning (ignore towers)
            if (TaskAssignmentManager.routeToCoreStructures(creep, roomState, false)) return;

            // Priority 3: Critical Repairs (Structures < 50% or Walls/Ramparts < 5000)
            if (roomState.repairTargets && roomState.repairTargets.length > 0) {
                let bestRepair = null;
                let bestRepairDist = Infinity;
                for (let i = 0; i < roomState.repairTargets.length; i++) {
                    const t = roomState.repairTargets[i];
                    let isCritical = false;
                    if (t.structureType === STRUCTURE_WALL || t.structureType === STRUCTURE_RAMPART) {
                        if (t.hits < 5000) isCritical = true;
                    } else if (t.hits < t.hitsMax * 0.5) {
                        if (t.structureType === STRUCTURE_SPAWN || t.structureType === STRUCTURE_TOWER || t.structureType === STRUCTURE_EXTENSION) {
                            isCritical = true;
                        }
                    }
                    if (isCritical) {
                        const dist = Math.max(Math.abs(creep.pos.x - t.pos.x), Math.abs(creep.pos.y - t.pos.y));
                        if (dist < bestRepairDist) {
                            bestRepairDist = dist;
                            bestRepair = t;
                        }
                    }
                }
                if (bestRepair) {
                    creep.heap.targetId = bestRepair.id;
                    creep.heap.actionIntent = ActionConstants.ACTION_REPAIR;
                    return;
                }
            }

            // Priority 4: Build critical structures (Spawns/Towers heavily prioritized)
            if (roomState.constructionSites) {
                let bestSite = null;
                let bestScore = -1;
                for (const siteId in roomState.constructionSites) {
                    const s = CacheLib.getById(siteId) || roomState.constructionSites[siteId];
                    if (!s) continue;
                    let dist = Math.max(Math.abs(creep.pos.x - s.pos.x), Math.abs(creep.pos.y - s.pos.y)) || 1;
                    
                    // Massive artificial distance reduction for critical sites
                    if (s.structureType === STRUCTURE_SPAWN || s.structureType === STRUCTURE_TOWER) {
                        dist = dist * 0.1;
                    }

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