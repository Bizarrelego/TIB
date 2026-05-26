
function setHeap(creep, key, val) { if (creep.heap instanceof Map) creep.heap.set(key, val); else creep.heap[key] = val; }
function hasHeap(creep, key) { return creep.heap instanceof Map ? creep.heap.has(key) : creep.heap[key] !== undefined; }
function getHeap(creep, key) { return creep.heap instanceof Map ? creep.heap.get(key) : creep.heap[key]; }
const eventBus = require('../os/eventBus');
const TrafficManager = require('../traffic/trafficManager');
const ResourceTransferLedger = require('./ResourceTransferLedger');
const EnergyRequestManager = require('../managers/EnergyRequestManager');
const Profiler = require('../utils/profiler');

const trainEngine = require('../roles/trainEngine');
const trainCart = require('../roles/trainCart');

/**
 * Returns the immediate 0-indexed quadrant of a position for fast spatial sorting.
 * @param {RoomPosition|Object} pos 
 * @returns {number} 0-3 Quadrant
 */
function getQuadrant(pos) {
    if (!pos) return 0;
    return (pos.x < 25 ? 0 : 1) + (pos.y < 25 ? 0 : 2);
}

/**
 * Calculates and caches Hub Park Data including the optimal position and strictly adjacent structure IDs.
 */
function getHubCache(storage, terminal, links, room) {
    if (!global.State.layoutCache) global.State.layoutCache = new Map();
    let roomCache = global.State.layoutCache.get(room.name);
    if (!roomCache) {
        roomCache = {};
        global.State.layoutCache.set(room.name, roomCache);
    }
    if (roomCache.hubParkData) return roomCache.hubParkData;

    let hubLink = null;
    let controllerLink = null;

    for (let i = 0; i < links.length; i++) {
        if (storage && Math.max(Math.abs(links[i].pos.x - storage.pos.x), Math.abs(links[i].pos.y - storage.pos.y)) <= 1) {
            hubLink = links[i];
        } else if (room.controller && Math.max(Math.abs(links[i].pos.x - room.controller.pos.x), Math.abs(links[i].pos.y - room.controller.pos.y)) <= 3) {
            controllerLink = links[i];
        }
    }

    if (!storage) return null;
    const terrain = global.State.roomTerrain.get(room.name);
    let bestPos = null;
    let maxAdjacency = -1;

    const structs = [hubLink, storage, terminal].filter(s => s != null);

    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
            const tx = storage.pos.x + dx;
            const ty = storage.pos.y + dy;
            if (terrain && terrain.get(tx, ty) === TERRAIN_MASK_WALL) continue;

            let adjacency = 0;
            for (let i = 0; i < structs.length; i++) {
                if (Math.abs(structs[i].pos.x - tx) <= 1 && Math.abs(structs[i].pos.y - ty) <= 1) adjacency++;
            }

            if (adjacency > maxAdjacency) {
                maxAdjacency = adjacency;
                bestPos = { x: tx, y: ty, roomName: room.name };
            }
        }
    }

    bestPos = bestPos || { x: storage.pos.x, y: storage.pos.y, roomName: room.name };
    roomCache.hubParkData = { pos: bestPos, hubLinkId: hubLink ? hubLink.id : null, controllerLinkId: controllerLink ? controllerLink.id : null };
    return roomCache.hubParkData;
}

/**
 * Calculates and caches Fast Filler Park Data including optimal position and strictly adjacent structure IDs.
 */
function getFastFillerCache(storage, spawns, extensions, links, room) {
    if (!global.State.layoutCache) global.State.layoutCache = new Map();
    let roomCache = global.State.layoutCache.get(room.name);
    if (!roomCache) {
        roomCache = {};
        global.State.layoutCache.set(room.name, roomCache);
    }
    if (roomCache.fastFillerParkData) return roomCache.fastFillerParkData;

    const terrain = global.State.roomTerrain.get(room.name);
    let bestPos = null;
    let maxAdjacency = -1;

    const centerObj = storage || (spawns.length > 0 ? spawns[0] : null);
    if (!centerObj) return null;

    const structs = [...spawns, ...extensions].filter(s => s != null);

    for (let dx = -2; dx <= 2; dx++) {
        for (let dy = -2; dy <= 2; dy++) {
            const tx = centerObj.pos.x + dx;
            const ty = centerObj.pos.y + dy;
            if (terrain && terrain.get(tx, ty) === TERRAIN_MASK_WALL) continue;
            if (storage && (Math.abs(storage.pos.x - tx) > 1 || Math.abs(storage.pos.y - ty) > 1)) continue;

            let adjacency = 0;
            for (let i = 0; i < structs.length; i++) {
                if (Math.abs(structs[i].pos.x - tx) <= 1 && Math.abs(structs[i].pos.y - ty) <= 1) adjacency++;
            }

            if (adjacency > maxAdjacency) {
                maxAdjacency = adjacency;
                bestPos = { x: tx, y: ty, roomName: room.name };
            }
        }
    }

    bestPos = bestPos || { x: centerObj.pos.x + 1, y: centerObj.pos.y, roomName: room.name };

    const adjacentIds = [];
    for (let i = 0; i < structs.length; i++) {
        if (Math.abs(structs[i].pos.x - bestPos.x) <= 1 && Math.abs(structs[i].pos.y - bestPos.y) <= 1) adjacentIds.push(structs[i].id);
    }
    
    const adjacentLinks = [];
    for (let i = 0; i < links.length; i++) {
        if (Math.abs(links[i].pos.x - bestPos.x) <= 1 && Math.abs(links[i].pos.y - bestPos.y) <= 1) adjacentLinks.push(links[i].id);
    }

    roomCache.fastFillerParkData = { pos: bestPos, adjacentIds, adjacentLinks };
    return roomCache.fastFillerParkData;
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
            const cacheData = getFastFillerCache(storage, spawns, extensions, links, room);
            const parkPos = cacheData ? cacheData.pos : null;
            const adjacentIds = cacheData ? cacheData.adjacentIds : [];
            const adjacentLinks = cacheData ? cacheData.adjacentLinks : [];

            for (let i = 0; i < fastFillers.length; i++) {
                const creep = fastFillers[i];
                if (creep.fatigue > 0 || TrafficManager.checkPipeline(creep.id)) continue;

                if (!(creep.heap instanceof Map)) {
                    creep.heap = new Map();
                }

                if (parkPos && !hasHeap(creep, 'parkPos')) {
                    setHeap(creep, 'parkPos', parkPos);
                }

                const creepState = ResourceTransferLedger.getAvailable(creep, RESOURCE_ENERGY);
                const storageState = storage ? ResourceTransferLedger.getAvailable(storage, RESOURCE_ENERGY) : null;
                const terminalState = terminal ? ResourceTransferLedger.getAvailable(terminal, RESOURCE_ENERGY) : null;

                let state = (creep.heap instanceof Map) ? getHeap(creep, 'state') : creep.heap.state;
                if (!state) state = 'emptying';
                if (creepState.used === 0) state = 'filling';
                else if (creepState.free === 0) state = 'emptying';

                if (creep.heap instanceof Map) {
                    setHeap(creep, 'state', state);
                } else {
                    creep.heap.state = state;
                }

                if (state === 'emptying') {
                    let target = null;
                    let targetAmount = 0;
                    
                    // O(1) Logistics Polling via global state caching
                    const needyExtensions = global.State.needyExtensions || new Set();

                    for (let j = 0; j < adjacentIds.length; j++) {
                        if (needyExtensions.has(adjacentIds[j])) {
                            const structObj = Game.getObjectById(adjacentIds[j]);
                            if (structObj) {
                                const structState = ResourceTransferLedger.getAvailable(structObj, RESOURCE_ENERGY);
                                target = structObj;
                                targetAmount = Math.min(creepState.used, structState.free);
                                break;
                            }
                        }
                    }

                    if (target) {
                        if (targetAmount > 0 && TrafficManager.registerTransfer(creep, target, RESOURCE_ENERGY, targetAmount) === OK) {
                            TrafficManager.lockPipeline(creep.name, creep.id, target.id, RESOURCE_ENERGY, targetAmount, 'TRANSFER');
                            setHeap(creep, 'targetId', target.id);
                        }
                    }
                } else if (state === 'filling') {
                    let source = null;
                    const isEmergencyRefill = room.energyAvailable < room.energyCapacityAvailable * 0.5;
                    if (storage && storageState.used > 0 && !(room.memory.restrictStorageOutflow && !isEmergencyRefill)) {
                        source = storage;
                    } else if (terminal && terminalState && terminalState.used > 0) {
                        source = terminal;
                    }

                    // Pre-computed adjacent link check
                    if (!source && adjacentLinks.length > 0) {
                        for (let j = 0; j < adjacentLinks.length; j++) {
                            const linkObj = Game.getObjectById(adjacentLinks[j]);
                            if (!linkObj) continue;
                            const linkState = ResourceTransferLedger.getAvailable(linkObj, RESOURCE_ENERGY);
                            if (linkState.used > 0) {
                                source = linkObj;
                                break;
                            }
                        }
                    }

                    if (source) {
                        const sourceState = ResourceTransferLedger.getAvailable(source, RESOURCE_ENERGY);
                        const amount = Math.min(creepState.free, sourceState.used);
                        if (amount > 0 && TrafficManager.registerWithdraw(creep, source, RESOURCE_ENERGY, amount) === OK) {
                            TrafficManager.lockPipeline(creep.name, creep.id, source.id, RESOURCE_ENERGY, amount, 'WITHDRAW');
                            setHeap(creep, 'sourceId', source.id);
                        }
                    }
                }
            }
        }

        // HAULER AND DOMESTIC HAULER ASSIGNMENT LOGIC via EnergyRequestManager
        const domesticHaulers = roomCreeps.get('domesticHauler') || [];
        const trainCarts = roomCreeps.get('trainCart') || [];
        const allHaulers = [...haulers, ...domesticHaulers, ...trainCarts];

        if (allHaulers.length > 0) {
            let requests = EnergyRequestManager.getEnergyRequests(room.name);
            const supplies = EnergyRequestManager.getEnergySupplies(room.name);
            
            const hasStorage = storage && storage.isActive();
            if (hasStorage) {
                // RCL 4 Storage Pivot: Haulers must dump ONLY into Storage
                requests = requests.filter(r => r.target.structureType === STRUCTURE_STORAGE || r.target.structureType === STRUCTURE_TERMINAL);
            }

            let requestIndex = 0;
            let supplyIndex = 0;

            for (let i = 0; i < allHaulers.length; i++) {
                const creep = allHaulers[i];
                if (creep.fatigue > 0 || TrafficManager.checkPipeline(creep.id)) continue;
                if (creep.heap && creep.heap.retired) continue; // Respect domesticHauler retirement

                creep.heap = creep.heap || {};

                const creepState = ResourceTransferLedger.getAvailable(creep, RESOURCE_ENERGY);
                const creepQuad = getQuadrant(creep.pos);

                if (creepState.used === 0 || (creepState.free > 0 && creep.heap.state !== 'transfer' && supplyIndex < supplies.length)) {
                    // Needs energy -> pickup
                    creep.heap.state = 'pickup';
                    creep.heap.targetId = null;

                    let selectedSupply = null;
                    let selectedIdx = -1;

                    for (let j = supplyIndex; j < supplies.length; j++) {
                        const supply = supplies[j];
                        const supplyState = ResourceTransferLedger.getAvailable(supply.target, RESOURCE_ENERGY);

                        if (supplyState.used > 0) {
                            if (!selectedSupply) { selectedSupply = supply; selectedIdx = j; }
                            
                            // Fast Spatial Filter: Lock targets in immediate quadrant if available
                            if (getQuadrant(supply.target.pos) === creepQuad) {
                                selectedSupply = supply;
                                selectedIdx = j;
                                break;
                            }
                            if (j - supplyIndex > 4) break;
                        } else if (j === supplyIndex) {
                            supplyIndex++;
                        }
                    }

                    if (selectedSupply) {
                        const amountToTake = Math.min(creepState.free, ResourceTransferLedger.getAvailable(selectedSupply.target, RESOURCE_ENERGY).used);
                        let status;

                        if (selectedSupply.target instanceof Resource) {
                            status = TrafficManager.registerPickup(creep, selectedSupply.target, RESOURCE_ENERGY, amountToTake);
                            if (status === OK) {
                                TrafficManager.lockPipeline(creep.name, creep.id, selectedSupply.target.id, RESOURCE_ENERGY, amountToTake, 'PICKUP');
                            }
                        } else {
                            status = TrafficManager.registerWithdraw(creep, selectedSupply.target, RESOURCE_ENERGY, amountToTake);
                            if (status === OK) {
                                TrafficManager.lockPipeline(creep.name, creep.id, selectedSupply.target.id, RESOURCE_ENERGY, amountToTake, 'WITHDRAW');
                            }
                        }

                        if (status === OK) {
                            creep.heap.dropId = selectedSupply.target.id;
                            creep.heap.resourceType = RESOURCE_ENERGY;

                            const updatedSupplyState = ResourceTransferLedger.getAvailable(selectedSupply.target, RESOURCE_ENERGY);
                            if (updatedSupplyState.used <= 0 && selectedIdx === supplyIndex) {
                                supplyIndex++;
                            }
                        }
                    } else {
                        creep.heap.dropId = null;
                    }

                } else {
                    // Has energy -> transfer
                    creep.heap.state = 'transfer';
                    creep.heap.dropId = null;

                    let selectedReq = null;
                    let selectedIdx = -1;

                    for (let j = requestIndex; j < requests.length; j++) {
                        const request = requests[j];
                        const requestState = ResourceTransferLedger.getAvailable(request.target, RESOURCE_ENERGY);

                        if (requestState.free > 0) {
                            if (!selectedReq) { selectedReq = request; selectedIdx = j; }
                            
                            // Fast Spatial Filter: Lock targets in immediate quadrant if available
                            if (getQuadrant(request.target.pos) === creepQuad) {
                                selectedReq = request;
                                selectedIdx = j;
                                break;
                            }
                            if (j - requestIndex > 4) break;
                        } else if (j === requestIndex) {
                            requestIndex++;
                        }
                    }

                    if (selectedReq) {
                        const amountToTransfer = Math.min(creepState.used, ResourceTransferLedger.getAvailable(selectedReq.target, RESOURCE_ENERGY).free);
                        if (TrafficManager.registerTransfer(creep, selectedReq.target, RESOURCE_ENERGY, amountToTransfer) === OK) {
                            TrafficManager.lockPipeline(creep.name, creep.id, selectedReq.target.id, RESOURCE_ENERGY, amountToTransfer, 'TRANSFER');

                            creep.heap.targetId = selectedReq.target.id;
                            creep.heap.resourceType = RESOURCE_ENERGY;

                            const updatedRequestState = ResourceTransferLedger.getAvailable(selectedReq.target, RESOURCE_ENERGY);
                            if (updatedRequestState.free <= 0 && selectedIdx === requestIndex) {
                                requestIndex++;
                            }
                        }
                    } else {
                        if (room.controller) {
                            creep.heap.targetId = 'controller';
                        } else {
                            creep.heap.targetId = null;
                        }
                    }
                }
            }
        }


        // HAULER & DOMESTIC HAULER ASSIGNMENT LOGIC
        const domesticHaulers = roomCreeps.get('domesticHauler') || [];
        const structures = global.State.structuresByRoom.get(room.name);
        const fastFillers = roomCreeps.get('fastFiller') || [];
        const ignoreCore = fastFillers.length > 0;

        // Domestic Haulers (Source: Drops/Containers/Storage -> Sink: Spawns/Ext/Towers/Storage)
        for (let i = 0; i < domesticHaulers.length; i++) {
            const creep = domesticHaulers[i];
            if (!creep.heap) creep.heap = {};
            if (creep.heap.retired) continue;

            // State Transitions
            if (creep.heap.state !== 'pickup' && creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
                creep.heap.state = 'pickup';
                creep.heap.targetId = null;
            } else if (creep.heap.state !== 'transfer' && creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
                creep.heap.state = 'transfer';
                creep.heap.targetId = null;
            } else if (!creep.heap.state) {
                creep.heap.state = 'pickup';
            }

            // Target Validation (Partial drops/pickups or missing targets)
            if (creep.heap.targetId) {
                const targetObj = Game.getObjectById(creep.heap.targetId);
                if (!targetObj && creep.heap.targetId !== 'controller') {
                    creep.heap.targetId = null;
                } else if (targetObj) {
                    if (creep.heap.state === 'pickup' && ((targetObj.amount !== undefined && targetObj.amount === 0) || (targetObj.store && targetObj.store.getUsedCapacity(RESOURCE_ENERGY) === 0))) {
                        creep.heap.targetId = null;
                    } else if (creep.heap.state === 'transfer' && targetObj.store && targetObj.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
                        creep.heap.targetId = null;
                    }
                }
            }

            if (!creep.heap.targetId) {
                if (creep.heap.state === 'transfer') {
                    let target = null;
                    if (structures) {
                        const spawnsMap = structures.get(STRUCTURE_SPAWN);
                        if (spawnsMap && !target) {
                            for (const spawn of spawnsMap.values()) {
                                if (spawn.store.getFreeCapacity(RESOURCE_ENERGY) > 0) { target = spawn; break; }
                            }
                        }
                        const extensionsMap = structures.get(STRUCTURE_EXTENSION);
                        if (extensionsMap && !target) {
                            for (const ext of extensionsMap.values()) {
                                if (ext.store.getFreeCapacity(RESOURCE_ENERGY) > 0) { target = ext; break; }
                            }
                        }
                        const towersMap = structures.get(STRUCTURE_TOWER);
                        if (towersMap && !target) {
                            for (const tower of towersMap.values()) {
                                if (tower.store.getFreeCapacity(RESOURCE_ENERGY) > 0) { target = tower; break; }
                            }
                        }
                        const storageMap = structures.get(STRUCTURE_STORAGE);
                        if (storageMap && !target) {
                            for (const storage of storageMap.values()) {
                                if (storage.store.getFreeCapacity(RESOURCE_ENERGY) > 0) { target = storage; break; }
                            }
                        }
                    }
                    if (!target && !creep.heap.ignoreController && room.controller) {
                        target = room.controller;
                    }
                    if (target) {
                        creep.heap.targetId = target.id === room.controller?.id ? 'controller' : target.id;
                    }
                } else if (creep.heap.state === 'pickup') {
                    let target = null;
                    const dropped = global.State.droppedByRoom.get(room.name);
                    if (dropped && dropped.length > 0) {
                        let minDistance = Infinity;
                        for (let j = 0; j < dropped.length; j++) {
                            const drop = dropped[j];
                            if (drop.resourceType === RESOURCE_ENERGY && drop.amount >= 50) {
                                const dist = creep.pos.getRangeTo(drop);
                                if (dist < minDistance) { minDistance = dist; target = drop; }
                            }
                        }
                    }
                    if (!target && structures) {
                        const containersMap = structures.get(STRUCTURE_CONTAINER);
                        if (containersMap && !target) {
                            let maxEnergy = 0;
                            for (const container of containersMap.values()) {
                                const energy = container.store.getUsedCapacity(RESOURCE_ENERGY);
                                if (energy > maxEnergy) { maxEnergy = energy; target = container; }
                            }
                        }
                        const storageMap = structures.get(STRUCTURE_STORAGE);
                        if (storageMap && !target) {
                            for (const storage of storageMap.values()) {
                                if (storage.store.getUsedCapacity(RESOURCE_ENERGY) > 0) { target = storage; break; }
                            }
                        }
                        const linksMap = structures.get(STRUCTURE_LINK);
                        if (linksMap && !target) {
                            for (const link of linksMap.values()) {
                                if (link.store.getUsedCapacity(RESOURCE_ENERGY) > 0) { target = link; break; }
                            }
                        }
                    }

                    if (target) {
                        creep.heap.targetId = target.id;
                        creep.heap.state = target.amount !== undefined ? 'pickup' : 'withdraw'; // Properly format the state for the dumb role
                    }
                }
            }
        }

        // General Haulers (Source: Drops/Containers -> Sink: Storage/Spawns/Towers/Controller)
        for (let i = 0; i < haulers.length; i++) {
            const creep = haulers[i];
            if (!creep.heap) creep.heap = {};

            // State Transitions
            if (creep.heap.state !== 'pickup' && creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
                creep.heap.state = 'pickup';
                creep.heap.targetId = null;
            } else if (creep.heap.state !== 'transfer' && creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
                creep.heap.state = 'transfer';
                creep.heap.targetId = null;
            } else if (!creep.heap.state) {
                creep.heap.state = 'pickup';
            }

            // Target Validation (Partial drops/pickups or missing targets)
            if (creep.heap.targetId) {
                const targetObj = Game.getObjectById(creep.heap.targetId);
                if (!targetObj && creep.heap.targetId !== 'controller') {
                    creep.heap.targetId = null;
                } else if (targetObj) {
                    if (creep.heap.state === 'pickup' && ((targetObj.amount !== undefined && targetObj.amount === 0) || (targetObj.store && targetObj.store.getUsedCapacity(RESOURCE_ENERGY) === 0))) {
                        creep.heap.targetId = null;
                    } else if (creep.heap.state === 'transfer' && targetObj.store && targetObj.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
                        creep.heap.targetId = null;
                    }
                }
            }

            if (!creep.heap.targetId) {
                if (creep.heap.state === 'pickup') {
                    let target = null;
                    const dropped = global.State.droppedByRoom.get(room.name);
                    if (dropped && dropped.length > 0) {
                        let minDistance = Infinity;
                        for (let j = 0; j < dropped.length; j++) {
                            const drop = dropped[j];
                            if (drop.resourceType === RESOURCE_ENERGY && drop.amount >= 50) {
                                const dist = creep.pos.getRangeTo(drop);
                                if (dist < minDistance) { minDistance = dist; target = drop; }
                            }
                        }
                    }
                    if (!target && room.storage && room.storage.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                        target = room.storage;
                    } else if (!target && structures) {
                        const containersMap = structures.get(STRUCTURE_CONTAINER);
                        if (containersMap && !target) {
                            let maxEnergy = 0;
                            for (const container of containersMap.values()) {
                                const energy = container.store.getUsedCapacity(RESOURCE_ENERGY);
                                if (energy > maxEnergy) { maxEnergy = energy; target = container; }
                            }
                        }
                    }
                    if (target) {
                        creep.heap.targetId = target.id;
                        creep.heap.state = target.amount !== undefined ? 'pickup' : 'withdraw'; // Safely route for dumb role
                    }
                } else if (creep.heap.state === 'transfer') {
                    let target = null;
                    if (ignoreCore) {
                        if (room.storage && room.storage.isActive() && room.storage.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                            target = room.storage;
                        } else if (structures) {
                            const spawnsMap = structures.get(STRUCTURE_SPAWN);
                            if (spawnsMap && !target) {
                                for (const spawn of spawnsMap.values()) {
                                    if (spawn.store.getFreeCapacity(RESOURCE_ENERGY) > 0) { target = spawn; break; }
                                }
                            }
                            const extensionsMap = structures.get(STRUCTURE_EXTENSION);
                            if (extensionsMap && !target) {
                                for (const ext of extensionsMap.values()) {
                                    if (ext.store.getFreeCapacity(RESOURCE_ENERGY) > 0) { target = ext; break; }
                                }
                            }
                        }
                        if (!target && !creep.heap.ignoreController && room.controller) {
                            const upgraders = roomCreeps.get('upgrader') || [];
                            if (upgraders.length > 0 && !room.storage) {
                                target = room.controller;
                            }
                        }
                    }

                    if (!target && room.storage && room.storage.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                        target = room.storage;
                    }

                    if (target) {
                        creep.heap.targetId = target.id === room.controller?.id ? 'controller' : target.id;
                    }
                }
            }
        }

        // HUB MANAGER ASSIGNMENT LOGIC


        if (hubManagers.length > 0 && storage) {
            const hubCache = getHubCache(storage, terminal, links, room);
            if (!hubCache) return;
            
            const hubLink = hubCache.hubLinkId ? Game.getObjectById(hubCache.hubLinkId) : null;
            const controllerLink = hubCache.controllerLinkId ? Game.getObjectById(hubCache.controllerLinkId) : null;
            const parkPos = hubCache.pos;

            if (hubLink) {
                if (controllerLink) {
                    eventBus.publish('LINK_ROUTE_ACTIVE', { roomName: room.name, route: 'controller' });
                }

                const controllerState = controllerLink ? ResourceTransferLedger.getAvailable(controllerLink, RESOURCE_ENERGY) : null;
                const controllerNeedsEnergy = controllerState && controllerState.used < 400;

                for (let i = 0; i < hubManagers.length; i++) {
                    const creep = hubManagers[i];
                    if (creep.fatigue > 0 || TrafficManager.checkPipeline(creep.id)) continue;

                    if (!(creep.heap instanceof Map)) {
                        creep.heap = new Map();
                    }

                    if (parkPos && !hasHeap(creep, 'parkPos')) {
                        setHeap(creep, 'parkPos', parkPos);
                    }

                    const creepState = ResourceTransferLedger.getAvailable(creep, RESOURCE_ENERGY);
                    const hubLinkState = ResourceTransferLedger.getAvailable(hubLink, RESOURCE_ENERGY);
                    const storageState = ResourceTransferLedger.getAvailable(storage, RESOURCE_ENERGY);
                    const terminalState = terminal ? ResourceTransferLedger.getAvailable(terminal, RESOURCE_ENERGY) : null;

                    let actionRegistered = false;

                    if (creepState.used > 0) {
                        if (controllerNeedsEnergy && hubLinkState.free > 0) {
                            const amount = Math.min(creepState.used, hubLinkState.free);
                            if (TrafficManager.registerTransfer(creep, hubLink, RESOURCE_ENERGY, amount) === OK) {
                                TrafficManager.lockPipeline(creep.name, creep.id, hubLink.id, RESOURCE_ENERGY, amount, 'TRANSFER');
                                setHeap(creep, 'state', 'fill_link');
                                setHeap(creep, 'sourceId', creep.id);
                                setHeap(creep, 'targetId', hubLink.id);
                                actionRegistered = true;
                            }
                        } else if (terminal && terminalState.free > 0 && storageState.used > 100000 && !controllerNeedsEnergy && hubLinkState.used === 0) {
                            const amount = Math.min(creepState.used, terminalState.free);
                            if (TrafficManager.registerTransfer(creep, terminal, RESOURCE_ENERGY, amount) === OK) {
                                TrafficManager.lockPipeline(creep.name, creep.id, terminal.id, RESOURCE_ENERGY, amount, 'TRANSFER');
                                setHeap(creep, 'state', 'fill_terminal');
                                setHeap(creep, 'sourceId', creep.id);
                                setHeap(creep, 'targetId', terminal.id);
                                actionRegistered = true;
                            }
                        } else if (storageState.free > 0) {
                            const amount = Math.min(creepState.used, storageState.free);
                            if (TrafficManager.registerTransfer(creep, storage, RESOURCE_ENERGY, amount) === OK) {
                                TrafficManager.lockPipeline(creep.name, creep.id, storage.id, RESOURCE_ENERGY, amount, 'TRANSFER');
                                setHeap(creep, 'state', 'fill_storage');
                                setHeap(creep, 'sourceId', creep.id);
                                setHeap(creep, 'targetId', storage.id);
                                actionRegistered = true;
                            }
                        }
                        if (!actionRegistered) {
                            setHeap(creep, 'state', 'SLEEP');
                        }
                    } else if (creepState.free > 0) {
                        if (!controllerNeedsEnergy && hubLinkState.used > 0) {
                            const amount = Math.min(creepState.free, hubLinkState.used);
                            if (TrafficManager.registerWithdraw(creep, hubLink, RESOURCE_ENERGY, amount) === OK) {
                                TrafficManager.lockPipeline(creep.name, creep.id, hubLink.id, RESOURCE_ENERGY, amount, 'WITHDRAW');
                                setHeap(creep, 'state', 'empty_link');
                                setHeap(creep, 'sourceId', hubLink.id);
                                setHeap(creep, 'targetId', creep.id);
                                actionRegistered = true;
                            }
                        } else if (controllerNeedsEnergy && hubLinkState.free > 0 && storageState.used > 0) {
                            const amount = Math.min(creepState.free, storageState.used);
                            if (TrafficManager.registerWithdraw(creep, storage, RESOURCE_ENERGY, amount) === OK) {
                                TrafficManager.lockPipeline(creep.name, creep.id, storage.id, RESOURCE_ENERGY, amount, 'WITHDRAW');
                                setHeap(creep, 'state', 'empty_storage');
                                setHeap(creep, 'sourceId', storage.id);
                                setHeap(creep, 'targetId', creep.id);
                                actionRegistered = true;
                            }
                        } else if (terminal && terminalState.free > 0 && storageState.used > 100000 && !controllerNeedsEnergy && hubLinkState.used === 0) {
                            const amount = Math.min(creepState.free, storageState.used);
                            if (TrafficManager.registerWithdraw(creep, storage, RESOURCE_ENERGY, amount) === OK) {
                                TrafficManager.lockPipeline(creep.name, creep.id, storage.id, RESOURCE_ENERGY, amount, 'WITHDRAW');
                                setHeap(creep, 'state', 'empty_storage');
                                setHeap(creep, 'sourceId', storage.id);
                                setHeap(creep, 'targetId', creep.id);
                                actionRegistered = true;
                            }
                        }

                        if (!actionRegistered && terminal && terminalState.used > 0 && storageState.free > 0 && !controllerNeedsEnergy) {
                            const amount = Math.min(creepState.free, terminalState.used);
                            if (TrafficManager.registerWithdraw(creep, terminal, RESOURCE_ENERGY, amount) === OK) {
                                TrafficManager.lockPipeline(creep.name, creep.id, terminal.id, RESOURCE_ENERGY, amount, 'WITHDRAW');
                                setHeap(creep, 'state', 'empty_terminal');
                                setHeap(creep, 'sourceId', terminal.id);
                                setHeap(creep, 'targetId', creep.id);
                                actionRegistered = true;
                            }
                        }

                        if (!actionRegistered) {
                            setHeap(creep, 'state', 'SLEEP');
                        }
                    }

                    if (creepState.used === 0 && !actionRegistered) {
                        setHeap(creep, 'state', 'SLEEP');
                    }
                }
            }
        }

        trainEngine.run(room);
        trainCart.run(room);
    }
};

LogisticsManager.run = Profiler.wrap('LogisticsManager.run', LogisticsManager.run);

module.exports = LogisticsManager;