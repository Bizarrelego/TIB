const eventBus = require('../os/eventBus');
const TrafficManager = require('../traffic/trafficManager');
const EnergyRequestManager = require('../managers/EnergyRequestManager');
const resourceUtils = require('../utils/resourceUtils');
const Profiler = require('../utils/profiler');

function findHubParkPos(hubLink, storage, terminal, room) {
    if (!storage) return null;
    const terrain = global.State.roomTerrain.get(room.name);
    let bestPos = null;
    let maxAdjacency = 0;

    const structs = [hubLink, storage, terminal].filter(s => s != null);

    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
            const tx = storage.pos.x + dx;
            const ty = storage.pos.y + dy;

            if (terrain && terrain.get(tx, ty) === TERRAIN_MASK_WALL) continue;

            let adjacency = 0;
            for (let i = 0; i < structs.length; i++) {
                if (Math.abs(structs[i].pos.x - tx) <= 1 && Math.abs(structs[i].pos.y - ty) <= 1) {
                    adjacency++;
                }
            }

            if (adjacency > maxAdjacency) {
                maxAdjacency = adjacency;
                bestPos = { x: tx, y: ty, roomName: room.name };
            }
        }
    }

    return bestPos || { x: storage.pos.x, y: storage.pos.y, roomName: room.name };
}

function findFastFillerParkPos(storage, spawns, extensions, room) {
    const terrain = global.State.roomTerrain.get(room.name);
    let bestPos = null;
    let maxAdjacency = 0;

    const centerObj = storage || (spawns.length > 0 ? spawns[0] : null);
    if (!centerObj) return null;

    const structs = [...spawns, ...extensions].filter(s => s != null);

    for (let dx = -2; dx <= 2; dx++) {
        for (let dy = -2; dy <= 2; dy++) {
            const tx = centerObj.pos.x + dx;
            const ty = centerObj.pos.y + dy;

            if (terrain && terrain.get(tx, ty) === TERRAIN_MASK_WALL) continue;

            // Fast filler needs to be adjacent to storage if it exists to withdraw efficiently
            if (storage && (Math.abs(storage.pos.x - tx) > 1 || Math.abs(storage.pos.y - ty) > 1)) continue;

            let adjacency = 0;
            for (let i = 0; i < structs.length; i++) {
                if (Math.abs(structs[i].pos.x - tx) <= 1 && Math.abs(structs[i].pos.y - ty) <= 1) {
                    adjacency++;
                }
            }

            if (adjacency > maxAdjacency) {
                maxAdjacency = adjacency;
                bestPos = { x: tx, y: ty, roomName: room.name };
            }
        }
    }

    return bestPos || { x: centerObj.pos.x + 1, y: centerObj.pos.y, roomName: room.name };
}

const LogisticsManager = {
    run(roomName) {
        if (!global.State.structuresByRoom.has(roomName)) return;

        const room = Game.rooms[roomName];
        if (!room) return;

        const structuresMap = global.State.structuresByRoom.get(roomName) || new Map();
        const roomCreeps = global.State.creepsByRoom.get(roomName) || new Map();

        const storages = structuresMap.get(STRUCTURE_STORAGE) || [];
        const storage = storages[0];

        const spawns = structuresMap.get(STRUCTURE_SPAWN) || [];
        const extensions = structuresMap.get(STRUCTURE_EXTENSION) || [];
        const links = structuresMap.get(STRUCTURE_LINK) || [];
        const terminals = structuresMap.get(STRUCTURE_TERMINAL) || [];
        const terminal = terminals[0];

        const fastFillers = roomCreeps.get('fastFiller') || [];
        const haulers = roomCreeps.get('hauler') || [];
        const hubManagers = roomCreeps.get('hubManager') || [];

        // FAST FILLER ASSIGNMENT LOGIC
        if (fastFillers.length > 0) {
            const parkPos = findFastFillerParkPos(storage, spawns, extensions, room);

            const needyStructures = [];
            for (let i = 0; i < spawns.length; i++) {
                if (spawns[i].store.getFreeCapacity(RESOURCE_ENERGY) > 0) { needyStructures.push(spawns[i]); }
            }
            for (let i = 0; i < extensions.length; i++) {
                if (extensions[i].store.getFreeCapacity(RESOURCE_ENERGY) > 0) { needyStructures.push(extensions[i]); }
            }

            const needsEmergencyRefill = needyStructures.length > 0 && storages.length > 0 && (spawns.every(s => s.store.getUsedCapacity(RESOURCE_ENERGY) === 0));

            for (let i = 0; i < fastFillers.length; i++) {
                const creep = fastFillers[i];
                if (creep.fatigue > 0 || TrafficManager.checkPipeline(creep.id)) continue;

                if (!(creep.heap instanceof Map)) {
                    creep.heap = new Map();
                }

                if (parkPos && !creep.heap.has('parkPos')) {
                    creep.heap.set('parkPos', parkPos);
                }

                const creepState = TrafficManager.getVirtualState(creep, RESOURCE_ENERGY);
                const storageState = storage ? TrafficManager.getVirtualState(storage, RESOURCE_ENERGY) : null;
                const terminalState = terminal ? TrafficManager.getVirtualState(terminal, RESOURCE_ENERGY) : null;

                let state = creep.heap.get('state') || 'emptying';
                if (creepState.used === 0) state = 'filling';
                else if (creepState.free === 0) state = 'emptying';
                creep.heap.set('state', state);

                if (state === 'emptying') {
                    let target = null;
                    for (let j = 0; j < needyStructures.length; j++) {
                        const struct = needyStructures[j];
                        const structState = TrafficManager.getVirtualState(struct, RESOURCE_ENERGY);
                        if (structState.free > 0 && creep.pos.isNearTo(struct)) {
                            target = struct;
                            break;
                        }
                    }

                    if (!target && needyStructures.length > 0) target = needyStructures[0];

                    if (target) {
                        const structState = TrafficManager.getVirtualState(target, RESOURCE_ENERGY);
                        const amount = Math.min(creepState.used, structState.free);
                        if (amount > 0 && TrafficManager.registerTransfer(creep, target, RESOURCE_ENERGY, amount) === OK) {
                            TrafficManager.lockPipeline(creep.name, creep.id, target.id, RESOURCE_ENERGY, amount, 'TRANSFER');
                            creep.heap.set('targetId', target.id);
                        }
                    }
                } else if (state === 'filling') {
                    let source = null;
                    if (storage && storageState.used > 0 && !(room.memory.restrictStorageOutflow && !needsEmergencyRefill)) {
                        source = storage;
                    } else if (terminal && terminalState && terminalState.used > 0) {
                        source = terminal;
                    }

                    // Allow links if needed
                    if (!source && links.length > 0) {
                        for(let j=0; j < links.length; j++) {
                            const linkState = TrafficManager.getVirtualState(links[j], RESOURCE_ENERGY);
                            if (linkState.used > 0 && creep.pos.isNearTo(links[j])) {
                                source = links[j];
                                break;
                            }
                        }
                    }

                    if (source) {
                        const sourceState = TrafficManager.getVirtualState(source, RESOURCE_ENERGY);
                        const amount = Math.min(creepState.free, sourceState.used);
                        if (amount > 0 && TrafficManager.registerWithdraw(creep, source, RESOURCE_ENERGY, amount) === OK) {
                            TrafficManager.lockPipeline(creep.name, creep.id, source.id, RESOURCE_ENERGY, amount, 'WITHDRAW');
                            creep.heap.set('sourceId', source.id);
                        }
                    }
                }
            }
        }

        // HAULER AND DOMESTIC HAULER ASSIGNMENT LOGIC via EnergyRequestManager
        const domesticHaulers = roomCreeps.get('domesticHauler') || [];
        const allHaulers = [...haulers, ...domesticHaulers];

        if (allHaulers.length > 0) {
            const requests = EnergyRequestManager.getEnergyRequests(room.name);
            const supplies = EnergyRequestManager.getEnergySupplies(room.name);

            let requestIndex = 0;
            let supplyIndex = 0;

            for (let i = 0; i < allHaulers.length; i++) {
                const creep = allHaulers[i];
                if (creep.fatigue > 0 || TrafficManager.checkPipeline(creep.id)) continue;
                if (creep.heap && creep.heap.retired) continue; // Respect domesticHauler retirement

                creep.heap = creep.heap || {};

                const creepState = TrafficManager.getVirtualState(creep, RESOURCE_ENERGY);

                if (creepState.used === 0 || (creepState.free > 0 && creep.heap.state !== 'transfer' && supplyIndex < supplies.length)) {
                    // Needs energy -> pickup
                    creep.heap.state = 'pickup';
                    creep.heap.targetId = null;

                    while (supplyIndex < supplies.length) {
                        const supply = supplies[supplyIndex];
                        const supplyState = TrafficManager.getVirtualState(supply.target, RESOURCE_ENERGY);

                        if (supplyState.used > 0) {
                            const amountToTake = Math.min(creepState.free, supplyState.used);
                            let status;

                            if (supply.target instanceof Resource) {
                                status = TrafficManager.registerPickup(creep, supply.target, RESOURCE_ENERGY, amountToTake);
                                if (status === OK) {
                                    TrafficManager.lockPipeline(creep.name, creep.id, supply.target.id, RESOURCE_ENERGY, amountToTake, 'PICKUP');
                                }
                            } else {
                                status = TrafficManager.registerWithdraw(creep, supply.target, RESOURCE_ENERGY, amountToTake);
                                if (status === OK) {
                                    TrafficManager.lockPipeline(creep.name, creep.id, supply.target.id, RESOURCE_ENERGY, amountToTake, 'WITHDRAW');
                                }
                            }

                            if (status === OK) {
                                creep.heap.dropId = supply.target.id;
                                creep.heap.resourceType = RESOURCE_ENERGY;

                                const updatedSupplyState = TrafficManager.getVirtualState(supply.target, RESOURCE_ENERGY);
                                if (updatedSupplyState.used <= 0) {
                                    supplyIndex++;
                                }
                                break;
                            } else {
                                supplyIndex++;
                            }
                        } else {
                            supplyIndex++;
                        }
                    }

                    if (supplyIndex >= supplies.length && !creep.heap.dropId) {
                        creep.heap.dropId = null;
                    }

                } else {
                    // Has energy -> transfer
                    creep.heap.state = 'transfer';
                    creep.heap.dropId = null;

                    while (requestIndex < requests.length) {
                        const request = requests[requestIndex];
                        const requestState = TrafficManager.getVirtualState(request.target, RESOURCE_ENERGY);

                        if (requestState.free > 0) {
                            const amountToTransfer = Math.min(creepState.used, requestState.free);
                            if (TrafficManager.registerTransfer(creep, request.target, RESOURCE_ENERGY, amountToTransfer) === OK) {
                                TrafficManager.lockPipeline(creep.name, creep.id, request.target.id, RESOURCE_ENERGY, amountToTransfer, 'TRANSFER');

                                creep.heap.targetId = request.target.id;
                                creep.heap.resourceType = RESOURCE_ENERGY;

                                const updatedRequestState = TrafficManager.getVirtualState(request.target, RESOURCE_ENERGY);
                                if (updatedRequestState.free <= 0) {
                                    requestIndex++;
                                }
                                break;
                            } else {
                                requestIndex++;
                            }
                        } else {
                            requestIndex++;
                        }
                    }

                    if (requestIndex >= requests.length && !creep.heap.targetId) {
                        if (room.controller) {
                            // Fallback to controller if no requests
                            creep.heap.targetId = 'controller';
                        } else {
                            creep.heap.targetId = null;
                        }
                    }
                }
            }
        }

        // HUB MANAGER ASSIGNMENT LOGIC
        if (hubManagers.length > 0 && links.length > 0 && storage) {
            let hubLink = null;
            let controllerLink = null;

            for (let i = 0; i < links.length; i++) {
                if (links[i].pos.isNearTo(storage)) {
                    hubLink = links[i];
                } else if (room.controller && links[i].pos.inRangeTo(room.controller, 3)) {
                    controllerLink = links[i];
                }
            }

            if (hubLink) {
                if (controllerLink) {
                    eventBus.publish('LINK_ROUTE_ACTIVE', { roomName: room.name, route: 'controller' });
                }

                const controllerState = controllerLink ? TrafficManager.getVirtualState(controllerLink, RESOURCE_ENERGY) : null;
                const controllerNeedsEnergy = controllerState && controllerState.used < 400;

                const parkPos = findHubParkPos(hubLink, storage, terminal, room);

                for (let i = 0; i < hubManagers.length; i++) {
                    const creep = hubManagers[i];
                    if (creep.fatigue > 0 || TrafficManager.checkPipeline(creep.id)) continue;

                    if (!(creep.heap instanceof Map)) {
                        creep.heap = new Map();
                    }

                    if (parkPos && !creep.heap.has('parkPos')) {
                        creep.heap.set('parkPos', parkPos);
                    }

                    const creepState = TrafficManager.getVirtualState(creep, RESOURCE_ENERGY);
                    const hubLinkState = TrafficManager.getVirtualState(hubLink, RESOURCE_ENERGY);
                    const storageState = TrafficManager.getVirtualState(storage, RESOURCE_ENERGY);
                    const terminalState = terminal ? TrafficManager.getVirtualState(terminal, RESOURCE_ENERGY) : null;

                    let actionRegistered = false;

                    if (creepState.used > 0) {
                        if (controllerNeedsEnergy && hubLinkState.free > 0) {
                            const amount = Math.min(creepState.used, hubLinkState.free);
                            if (TrafficManager.registerTransfer(creep, hubLink, RESOURCE_ENERGY, amount) === OK) {
                                TrafficManager.lockPipeline(creep.name, creep.id, hubLink.id, RESOURCE_ENERGY, amount, 'TRANSFER');
                                creep.heap.set('state', 'fill_link');
                                creep.heap.set('sourceId', creep.id);
                                creep.heap.set('targetId', hubLink.id);
                                actionRegistered = true;
                            }
                        } else if (terminal && terminalState.free > 0 && storageState.used > 100000 && !controllerNeedsEnergy && hubLinkState.used === 0) {
                            const amount = Math.min(creepState.used, terminalState.free);
                            if (TrafficManager.registerTransfer(creep, terminal, RESOURCE_ENERGY, amount) === OK) {
                                TrafficManager.lockPipeline(creep.name, creep.id, terminal.id, RESOURCE_ENERGY, amount, 'TRANSFER');
                                creep.heap.set('state', 'fill_terminal');
                                creep.heap.set('sourceId', creep.id);
                                creep.heap.set('targetId', terminal.id);
                                actionRegistered = true;
                            }
                        } else if (storageState.free > 0) {
                            const amount = Math.min(creepState.used, storageState.free);
                            if (TrafficManager.registerTransfer(creep, storage, RESOURCE_ENERGY, amount) === OK) {
                                TrafficManager.lockPipeline(creep.name, creep.id, storage.id, RESOURCE_ENERGY, amount, 'TRANSFER');
                                creep.heap.set('state', 'fill_storage');
                                creep.heap.set('sourceId', creep.id);
                                creep.heap.set('targetId', storage.id);
                                actionRegistered = true;
                            }
                        }
                        if (!actionRegistered) {
                            creep.heap.set('state', 'SLEEP');
                        }
                    } else if (creepState.free > 0) {
                        if (!controllerNeedsEnergy && hubLinkState.used > 0) {
                            const amount = Math.min(creepState.free, hubLinkState.used);
                            if (TrafficManager.registerWithdraw(creep, hubLink, RESOURCE_ENERGY, amount) === OK) {
                                TrafficManager.lockPipeline(creep.name, creep.id, hubLink.id, RESOURCE_ENERGY, amount, 'WITHDRAW');
                                creep.heap.set('state', 'empty_link');
                                creep.heap.set('sourceId', hubLink.id);
                                creep.heap.set('targetId', creep.id);
                                actionRegistered = true;
                            }
                        } else if (controllerNeedsEnergy && hubLinkState.free > 0 && storageState.used > 0) {
                            const amount = Math.min(creepState.free, storageState.used);
                            if (TrafficManager.registerWithdraw(creep, storage, RESOURCE_ENERGY, amount) === OK) {
                                TrafficManager.lockPipeline(creep.name, creep.id, storage.id, RESOURCE_ENERGY, amount, 'WITHDRAW');
                                creep.heap.set('state', 'empty_storage');
                                creep.heap.set('sourceId', storage.id);
                                creep.heap.set('targetId', creep.id);
                                actionRegistered = true;
                            }
                        } else if (terminal && terminalState.free > 0 && storageState.used > 100000 && !controllerNeedsEnergy && hubLinkState.used === 0) {
                            const amount = Math.min(creepState.free, storageState.used);
                            if (TrafficManager.registerWithdraw(creep, storage, RESOURCE_ENERGY, amount) === OK) {
                                TrafficManager.lockPipeline(creep.name, creep.id, storage.id, RESOURCE_ENERGY, amount, 'WITHDRAW');
                                creep.heap.set('state', 'empty_storage');
                                creep.heap.set('sourceId', storage.id);
                                creep.heap.set('targetId', creep.id);
                                actionRegistered = true;
                            }
                        }

                        if (!actionRegistered && terminal && terminalState.used > 0 && storageState.free > 0 && !controllerNeedsEnergy) {
                            const amount = Math.min(creepState.free, terminalState.used);
                            if (TrafficManager.registerWithdraw(creep, terminal, RESOURCE_ENERGY, amount) === OK) {
                                TrafficManager.lockPipeline(creep.name, creep.id, terminal.id, RESOURCE_ENERGY, amount, 'WITHDRAW');
                                creep.heap.set('state', 'empty_terminal');
                                creep.heap.set('sourceId', terminal.id);
                                creep.heap.set('targetId', creep.id);
                                actionRegistered = true;
                            }
                        }

                        if (!actionRegistered) {
                            creep.heap.set('state', 'SLEEP');
                        }
                    }

                    if (creepState.used === 0 && !actionRegistered) {
                        creep.heap.set('state', 'SLEEP');
                    }
                }
            }
        }
    }
};

LogisticsManager.run = Profiler.wrap('LogisticsManager.run', LogisticsManager.run);

module.exports = LogisticsManager;