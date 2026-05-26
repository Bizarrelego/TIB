/**
 * @file RemoteEconomyManager.js
 * @description Executes Top-Down Assignment for remote economy roles.
 */
const SpawnQueueManager = require('./SpawnQueueManager');
const haulerSizing = require('../colonies/haulerSizing');
const BodyCalc = require('../utils/bodyCalc');

const RemoteEconomyManager = {
    /**
     * Evaluates room state and assigns target sources and containers directly to creep memory/heap.
     * @param {Room} room
     */
    run(room) {
        let colonyRemoteHarvesters = [];
        let colonyRemoteHaulers = [];
        const remoteRoomsTargeted = new Set();

        // Gather all creeps globally that belong to this colony
        for (const roomCreeps of global.State.creepsByRoom.values()) {
            const rHarvesters = roomCreeps.get('remoteHarvester');
            if (rHarvesters) {
                for (let i = 0; i < rHarvesters.length; i++) {
                    if (rHarvesters[i].memory.colony === room.name) {
                        colonyRemoteHarvesters.push(rHarvesters[i]);
                        remoteRoomsTargeted.add(rHarvesters[i].memory.targetRoom);
                    }
                }
            }

            const rHaulers = roomCreeps.get('remoteHauler');
            if (rHaulers) {
                for (let i = 0; i < rHaulers.length; i++) {
                    if (rHaulers[i].memory.colony === room.name) colonyRemoteHaulers.push(rHaulers[i]);
                }
            }
        }

        // Patch Vision-Loss Death Spirals
        for (const remoteRoomName of remoteRoomsTargeted) {
            if (!Memory.rooms[remoteRoomName]) Memory.rooms[remoteRoomName] = {};
            
            // Log recent threats
            if (global.State.hostilesByRoom && global.State.hostilesByRoom.get(remoteRoomName) && global.State.hostilesByRoom.get(remoteRoomName).size > 0) {
                Memory.rooms[remoteRoomName].threatExpiry = Game.time + 1500;
            }

            // Blind Defender Spawning
            if (Memory.rooms[remoteRoomName].threatExpiry > Game.time) {
                // Check if defender already deployed
                let activeDefenders = 0;
                const defenders = global.State.creepsByRoom.get(room.name)?.get('remoteDefender') || [];
                for (const d of defenders) {
                    if (d.memory.targetRoom === remoteRoomName) activeDefenders++;
                }
                if (activeDefenders === 0) {
                    const body = [TOUGH, TOUGH, MOVE, MOVE, MOVE, MOVE, RANGED_ATTACK, RANGED_ATTACK]; // Minimal defense
                    SpawnQueueManager.requestSpawn(room.name, 'remoteDefender', body, 'rd_' + Game.time, {
                        memory: { role: 'remoteDefender', colony: room.name, targetRoom: remoteRoomName }
                    }, 500);
                }
                
                // Filter out assigned civilians to prevent walking into blind death
                colonyRemoteHarvesters = colonyRemoteHarvesters.filter(c => c.memory.targetRoom !== remoteRoomName);
                colonyRemoteHaulers = colonyRemoteHaulers.filter(c => c.memory.remoteRoom !== remoteRoomName);
            }

            // Dynamic Hauler Sizing
            const hasThreat = Memory.rooms && Memory.rooms[remoteRoomName] && Memory.rooms[remoteRoomName].threatExpiry > Game.time;
            if (!hasThreat) {
                const roomRemoteHarvesters = colonyRemoteHarvesters.filter(c => c.memory.targetRoom === remoteRoomName);
                if (roomRemoteHarvesters.length > 0) {
                    let droppedEnergy = 0;
                    if (global.State.droppedByRoom && global.State.droppedByRoom.has(remoteRoomName)) {
                        const dropped = global.State.droppedByRoom.get(remoteRoomName) || [];
                        for (const drop of dropped) {
                            if (drop.resourceType === RESOURCE_ENERGY) {
                                droppedEnergy += drop.amount;
                            }
                        }
                    }

                    const pathLength = Game.map.getRoomLinearDistance(room.name, remoteRoomName) * 50;
                    const energyPerTick = roomRemoteHarvesters.length * 10;
                    const requiredCarry = haulerSizing.getRequiredCarryParts(pathLength, droppedEnergy, energyPerTick);

                    let activeCarry = 0;
                    const roomRemoteHaulers = colonyRemoteHaulers.filter(c => c.memory.remoteRoom === remoteRoomName);
                    for (const hauler of roomRemoteHaulers) {
                        activeCarry += hauler.getActiveBodyparts(CARRY);
                    }

                    const queuedCarry = SpawnQueueManager.getQueuedCarryParts(room.name, 'remoteHauler', remoteRoomName);

                    if (activeCarry + queuedCarry < requiredCarry) {
                        const capacity = room.energyCapacityAvailable;
                        const body = haulerSizing.calculateBody(capacity, requiredCarry);
                        const cost = BodyCalc.getCost(body);
                        if (capacity >= cost) {
                            SpawnQueueManager.requestSpawn(room.name, 'remoteHauler', body, 'remoteHauler_' + Game.time, {
                                memory: { role: 'remoteHauler', colony: room.name, homeRoom: room.name, remoteRoom: remoteRoomName, containerId: null }
                            }, cost);
                        }
                    }
                }
            }
        }

        // Deploy remote miners and haulers to 1-2 adjacent rooms using cached paths
        const exits = Game.map.describeExits(room.name);
        if (exits) {
            for (const direction in exits) {
                const targetRoomName = exits[direction];
                const route = Game.map.findRoute(room.name, targetRoomName);
                if (route && route.length <= 2) {
                    // Cache the route for future use (simplified here, assume it's valid)
                    if (!global.State.remoteRoutes) global.State.remoteRoutes = new Map();
                    let routes = global.State.remoteRoutes.get(room.name);
                    if (!routes) {
                        routes = new Map();
                        global.State.remoteRoutes.set(room.name, routes);
                    }
                    routes.set(targetRoomName, route);
                }
            }
        }

        if (colonyRemoteHarvesters.length > 0) {
            for (const creep of colonyRemoteHarvesters) {
                // Ensure homeRoom and targetRoom are consistent
                if (!creep.memory.homeRoom) creep.memory.homeRoom = room.name;

                if (!creep.heap.targetSourceId && creep.room.name === creep.memory.targetRoom) {
                    const roomSources = global.State.sourcesByRoom.get(creep.room.name) || [];
                    const assignedSources = colonyRemoteHarvesters.map(c => c.memory.targetSourceId).filter(id => id);

                    for (const src of roomSources) {
                        if (!assignedSources.includes(src.id)) {
                            creep.heap.targetSourceId = src.id;
                            break;
                        }
                    }
                }

                // Container lifecycle awareness for harvesters
                if (creep.heap.containerId && Game.rooms[creep.memory.targetRoom]) {
                    // Room is visible, check if container exists
                    const container = Game.getObjectById(creep.heap.containerId);
                    if (!container) {
                        creep.heap.containerId = null; // Container destroyed or invalid
                    }
                }
            }
        }

        if (colonyRemoteHaulers.length > 0) {
            for (const creep of colonyRemoteHaulers) {
                // Ensure homeRoom and remoteRoom are consistent
                if (!creep.memory.homeRoom) creep.memory.homeRoom = room.name;

                // Container lifecycle awareness for haulers
                if (creep.heap.containerId && Game.rooms[creep.memory.remoteRoom]) {
                    // Room is visible, check if container exists
                    const container = Game.getObjectById(creep.heap.containerId);
                    if (!container) {
                        creep.heap.containerId = null; // Container destroyed or invalid
                    }
                }

                // Drop mining sweep logic
                if (creep.store.getUsedCapacity() === 0) {
                    creep.heap.state = 'pickup';
                } else if (creep.store.getFreeCapacity() === 0) {
                    creep.heap.state = 'transfer';
                }

                if (!creep.heap.state) {
                    creep.heap.state = 'pickup';
                }

                if (creep.heap.state === 'pickup' && creep.room.name === creep.memory.remoteRoom) {
                    const droppedArray = global.State.droppedByRoom.get(creep.room.name);
                    let target = null;
                    let bestScore = -Infinity;
                    if (droppedArray) {
                        for (const dropped of droppedArray.values()) {
                            if (dropped.resourceType === RESOURCE_ENERGY && dropped.amount > 0) {
                                const distance = creep.pos.getRangeTo(dropped);
                                const score = dropped.amount - (distance * 10);
                                if (!target || score > bestScore) {
                                    target = dropped;
                                    bestScore = score;
                                }
                            }
                        }
                    }
                    if (target) {
                        creep.heap.targetId = target.id;
                    } else {
                        creep.heap.targetId = null;
                    }
                } else if (creep.heap.state === 'transfer' && creep.room.name === creep.memory.homeRoom) {
                    const structuresMap = global.State.structuresByRoom.get(creep.room.name);
                    if (structuresMap) {
                        let target = null;
                        const restrictStorageOutflow = Game.rooms[creep.memory.homeRoom] && Game.rooms[creep.memory.homeRoom].memory.restrictStorageOutflow;

                        if (!restrictStorageOutflow) {
                            const storages = structuresMap.get(STRUCTURE_STORAGE) || [];
                            if (storages.length > 0 && storages[0].store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                                target = storages[0];
                            }
                        }

                        if (!target && !restrictStorageOutflow) {
                            const terminals = structuresMap.get(STRUCTURE_TERMINAL) || [];
                            if (terminals.length > 0 && terminals[0].store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                                target = terminals[0];
                            }
                        }

                        if (!target) {
                            const spawns = global.State.spawnsByRoom.get(creep.memory.homeRoom) || [];
                            for (let i = 0; i < spawns.length; i++) {
                                if (spawns[i].store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                                    target = spawns[i];
                                    break;
                                }
                            }
                        }
                        if (!target) {
                            const extensions = structuresMap.get(STRUCTURE_EXTENSION) || [];
                            for (let i = 0; i < extensions.length; i++) {
                                if (extensions[i].store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                                    target = extensions[i];
                                    break;
                                }
                            }
                        }

                        if (!target) {
                            const storages = structuresMap.get(STRUCTURE_STORAGE) || [];
                            if (storages.length > 0) {
                                target = storages[0];
                            }
                        }

                        if (target) {
                            creep.heap.targetId = target.id;
                        } else {
                            creep.heap.targetId = null;
                        }
                    }
                }

            }
        }
    }
};

module.exports = RemoteEconomyManager;