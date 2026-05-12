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

/**
 * Executes the Hub Manager logic for a given room.
 * @param {Room} room The target room to process.
 * @returns {void}
 */
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
 * @typedef {Object} HubContext
 * @property {Room} room
 * @property {StructureLink} hubLink
 * @property {StructureStorage} storage
 * @property {StructureTerminal|undefined} terminal
 * @property {boolean} controllerNeedsEnergy
 * @property {Object} TrafficManager
 */

/**
 * Handles creep transfers to structures.
 * @param {Creep} creep
 * @param {HubContext} context
 * @param {{used: number, free: number, cap: number}} creepState
 * @returns {boolean} Whether an action was registered.
 */
function handleTransfer(creep, context, creepState) {
    const { hubLink, storage, terminal, controllerNeedsEnergy, TrafficManager } = context;
    const hubLinkState = TrafficManager.getVirtualState(hubLink, RESOURCE_ENERGY);
    const storageState = TrafficManager.getVirtualState(storage, RESOURCE_ENERGY);
    const terminalState = terminal ? TrafficManager.getVirtualState(terminal, RESOURCE_ENERGY) : null;

    if (controllerNeedsEnergy && hubLinkState.free > 0) {
        return TrafficManager.registerTransfer(creep, hubLink, RESOURCE_ENERGY, Math.min(creepState.used, hubLinkState.free)) === OK;
    }
    if (terminal && terminalState.free > 0 && storageState.used > 100000 && !controllerNeedsEnergy && hubLinkState.used === 0) {
        return TrafficManager.registerTransfer(creep, terminal, RESOURCE_ENERGY, Math.min(creepState.used, terminalState.free)) === OK;
    }
    if (storageState.free > 0) {
        return TrafficManager.registerTransfer(creep, storage, RESOURCE_ENERGY, Math.min(creepState.used, storageState.free)) === OK;
    }
    return false;
}

/**
 * Handles creep withdrawals from structures.
 * @param {Creep} creep
 * @param {HubContext} context
 * @param {{used: number, free: number, cap: number}} creepState
 * @returns {boolean} Whether an action was registered.
 */
function handleWithdraw(creep, context, creepState) {
    const { hubLink, storage, terminal, controllerNeedsEnergy, TrafficManager } = context;
    const hubLinkState = TrafficManager.getVirtualState(hubLink, RESOURCE_ENERGY);
    const storageState = TrafficManager.getVirtualState(storage, RESOURCE_ENERGY);
    const terminalState = terminal ? TrafficManager.getVirtualState(terminal, RESOURCE_ENERGY) : null;

    if (!controllerNeedsEnergy && hubLinkState.used > 0) {
        return TrafficManager.registerWithdraw(creep, hubLink, RESOURCE_ENERGY, Math.min(creepState.free, hubLinkState.used)) === OK;
    }
    if (controllerNeedsEnergy && hubLinkState.free > 0 && storageState.used > 0) {
        return TrafficManager.registerWithdraw(creep, storage, RESOURCE_ENERGY, Math.min(creepState.free, storageState.used)) === OK;
    }
    if (terminal && terminalState.free > 0 && storageState.used > 100000 && !controllerNeedsEnergy && hubLinkState.used === 0) {
        return TrafficManager.registerWithdraw(creep, storage, RESOURCE_ENERGY, Math.min(creepState.free, storageState.used)) === OK;
    }
    return false;
}

/**
 * Processes sub-tick transfers for all hubManager creeps in a room.
 * @param {Room} room
 * @param {Creep[]} hubManagers
 * @param {StructureLink} hubLink
 * @param {StructureStorage} storage
 * @param {StructureTerminal|undefined} terminal
 * @param {boolean} controllerNeedsEnergy
 * @param {Object} TrafficManager
 * @returns {void}
 */
function process(room, hubManagers, hubLink, storage, terminal, controllerNeedsEnergy, TrafficManager) {
    const context = { room, hubLink, storage, terminal, controllerNeedsEnergy, TrafficManager };

    for (let i = 0; i < hubManagers.length; i++) {
        const creep = hubManagers[i];
        creep.heap = creep.heap || {};

        if (!creep.heap.parkPos) {
            creep.heap.parkPos = findParkPos(hubLink, storage, room);
        }

        const creepState = TrafficManager.getVirtualState(creep, RESOURCE_ENERGY);
        let actionRegistered = false;

        if (creepState.used > 0) {
            actionRegistered = handleTransfer(creep, context, creepState);
            creep.heap.state = 'transfer';
        } else if (creepState.free > 0) {
            actionRegistered = handleWithdraw(creep, context, creepState);
            creep.heap.state = 'withdraw';
        }

        if (creepState.used === 0 && !actionRegistered) {
            creep.heap.state = 'SLEEP';
        }
    }
}

module.exports = { run };