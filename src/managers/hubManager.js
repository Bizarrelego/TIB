const eventBus = require('../os/eventBus');

function findParkPos(hubLink, storage, room) {
    const terrain = global.State.roomTerrain.get(room.name);
    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
            if (dx === 0 && dy === 0) continue;
            const tx = hubLink.pos.x + dx;
            const ty = hubLink.pos.y + dy;

            // Check if adjacent to storage and walkable
            if (Math.abs(storage.pos.x - tx) <= 1 && Math.abs(storage.pos.y - ty) <= 1) {
                if (terrain && terrain.get(tx, ty) !== TERRAIN_MASK_WALL) {
                    return { x: tx, y: ty, roomName: room.name };
                }
            }
        }
    }
    return { x: hubLink.pos.x, y: hubLink.pos.y, roomName: room.name };
}

function run(room) {
    try {
        const roomCreeps = global.State.creepsByRoom.get(room.name);
        if (!roomCreeps) return;

        const hubManagers = roomCreeps.get('hubManager');
        if (!hubManagers || hubManagers.length === 0) return;

        const structuresMap = global.State.structuresByRoom.get(room.name);
        if (!structuresMap) return;

        const links = structuresMap.get(STRUCTURE_LINK) || [];
        const storages = structuresMap.get(STRUCTURE_STORAGE) || [];
        if (links.length === 0 || storages.length === 0) return;

        const storage = storages[0];
        let hubLink = null;
        let controllerLink = null;

        // O(N) Link Mapping
        for (let i = 0; i < links.length; i++) {
            if (links[i].pos.isNearTo(storage)) {
                hubLink = links[i];
            } else if (room.controller && links[i].pos.inRangeTo(room.controller, 3)) {
                controllerLink = links[i];
            }
        }

        if (!hubLink) return;

        // Publish event to lock out Domestic Haulers
        if (controllerLink) {
            eventBus.publish('LINK_ROUTE_ACTIVE', { roomName: room.name, route: 'controller' });
        }

        const terminals = structuresMap.get(STRUCTURE_TERMINAL) || [];
        const terminal = terminals[0];

        const TrafficManager = require('../traffic/trafficManager');

        // Virtual Capacity checks to avoid function polling
        const controllerState = controllerLink ? TrafficManager.getVirtualState(controllerLink, RESOURCE_ENERGY) : null;
        const controllerNeedsEnergy = controllerState && controllerState.used < 400;

        process(room, hubManagers, hubLink, storage, terminal, controllerNeedsEnergy, TrafficManager);
    } catch (e) {
        console.log(`[HubManager Manager Error] Room ${room.name}: ${e.stack}`);
    }
}

/**
 * Processes assigned hub managers using standard persistent heap objects.
 * @param {Room} room - The current room context.
 * @param {Creep[]} hubManagers - An array of hub manager creeps.
 * @param {StructureLink} hubLink - The link structure to fill/empty.
 * @param {StructureStorage} storage - The central storage structure.
 * @param {StructureTerminal} terminal - The terminal structure for trade.
 * @param {boolean} controllerNeedsEnergy - State indicator.
 * @param {import('../traffic/trafficManager')} TrafficManager - Global TrafficManager.
 */
function process(room, hubManagers, hubLink, storage, terminal, controllerNeedsEnergy, TrafficManager) {
    try {
        for (let i = 0; i < hubManagers.length; i++) {
            const creep = hubManagers[i];
            if (creep.fatigue > 0 || TrafficManager.checkPipeline(creep.id)) continue;

            // Ensure persistence via object, use Map for local scope lookups if necessary
            creep.heap = creep.heap || {};
            const heap = creep.heap;

            if (!heap.parkPos) {
                heap.parkPos = findParkPos(hubLink, storage, room);
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
                        actionRegistered = true;
                    }
                } else if (terminal && terminalState.free > 0 && storageState.used > 100000 && !controllerNeedsEnergy && hubLinkState.used === 0) {
                    const amount = Math.min(creepState.used, terminalState.free);
                    if (TrafficManager.registerTransfer(creep, terminal, RESOURCE_ENERGY, amount) === OK) {
                        TrafficManager.lockPipeline(creep.name, creep.id, terminal.id, RESOURCE_ENERGY, amount, 'TRANSFER');
                        actionRegistered = true;
                    }
                } else if (storageState.free > 0) {
                    const amount = Math.min(creepState.used, storageState.free);
                    if (TrafficManager.registerTransfer(creep, storage, RESOURCE_ENERGY, amount) === OK) {
                        TrafficManager.lockPipeline(creep.name, creep.id, storage.id, RESOURCE_ENERGY, amount, 'TRANSFER');
                        actionRegistered = true;
                    }
                }
                heap.state = actionRegistered ? 'SLEEP' : 'transfer';
            } else if (creepState.free > 0) {
                if (!controllerNeedsEnergy && hubLinkState.used > 0) {
                    const amount = Math.min(creepState.free, hubLinkState.used);
                    if (TrafficManager.registerWithdraw(creep, hubLink, RESOURCE_ENERGY, amount) === OK) {
                        TrafficManager.lockPipeline(creep.name, creep.id, hubLink.id, RESOURCE_ENERGY, amount, 'WITHDRAW');
                        actionRegistered = true;
                    }
                } else if (controllerNeedsEnergy && hubLinkState.free > 0 && storageState.used > 0) {
                    const amount = Math.min(creepState.free, storageState.used);
                    if (TrafficManager.registerWithdraw(creep, storage, RESOURCE_ENERGY, amount) === OK) {
                        TrafficManager.lockPipeline(creep.name, creep.id, storage.id, RESOURCE_ENERGY, amount, 'WITHDRAW');
                        actionRegistered = true;
                    }
                } else if (terminal && terminalState.free > 0 && storageState.used > 100000 && !controllerNeedsEnergy && hubLinkState.used === 0) {
                    const amount = Math.min(creepState.free, storageState.used);
                    if (TrafficManager.registerWithdraw(creep, storage, RESOURCE_ENERGY, amount) === OK) {
                        TrafficManager.lockPipeline(creep.name, creep.id, storage.id, RESOURCE_ENERGY, amount, 'WITHDRAW');
                        actionRegistered = true;
                    }
                }
                heap.state = actionRegistered ? 'SLEEP' : 'withdraw';
            }

            if (creepState.used === 0 && !actionRegistered) {
                heap.state = 'SLEEP';
            }
        }
    } catch (e) {
        console.log(`[HubManager Process Error] Room ${room.name}: ${e.stack}`);
    }
}

module.exports = { run };