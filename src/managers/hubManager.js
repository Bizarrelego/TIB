const eventBus = require('../os/eventBus');

/**
 * @typedef {Object} HubHeap
 * @property {RoomPosition|null} parkPos
 * @property {string} state
 */

/**
 * @param {Room} room
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

        const hubManagersMap = new Map();
        for (let i = 0; i < hubManagers.length; i++) {
            hubManagersMap.set(hubManagers[i].id, hubManagers[i]);
        }

        process(room, hubManagersMap, hubLink, storage, terminal, controllerNeedsEnergy, TrafficManager);
    } catch (e) {
        console.log(`[HubManager Manager Error] Room ${room.name}: ${e.stack}`);
    }
}

/**
 * @param {Room} room
 * @param {Map<string, Creep>} hubManagers
 * @param {StructureLink} hubLink
 * @param {StructureStorage} storage
 * @param {StructureTerminal} terminal
 * @param {boolean} controllerNeedsEnergy
 * @param {Object} TrafficManager
 * @returns {void}
 */
function process(room, hubManagers, hubLink, storage, terminal, controllerNeedsEnergy, TrafficManager) {
    // Corrected: Use Map iteration for O(N) efficiency
    for (const [id, creep] of hubManagers) {
        if (TrafficManager.checkPipeline(id)) continue;

        // Corrected: Rehydrate from global.State on initialization
        if (!global.Heap.hubManagers.has(id)) {
            const pos = global.State.intel?.get(room.name)?.hubPos;
            global.Heap.hubManagers.set(id, { parkPos: pos, state: 'IDLE' });
        }

        const heap = global.Heap.hubManagers.get(id);

        const creepState = TrafficManager.getVirtualState(creep, RESOURCE_ENERGY);
        const hubLinkState = TrafficManager.getVirtualState(hubLink, RESOURCE_ENERGY);
        const storageState = TrafficManager.getVirtualState(storage, RESOURCE_ENERGY);
        const terminalState = terminal ? TrafficManager.getVirtualState(terminal, RESOURCE_ENERGY) : null;

        let actionRegistered = false;

        if (creepState.used > 0) {
            // Priority 1: Fill Link for Controller
            if (controllerNeedsEnergy && hubLinkState.free > 0) {
                const amount = Math.min(creepState.used, hubLinkState.free);
                if (TrafficManager.registerTransfer(creep, hubLink, RESOURCE_ENERGY, amount) === OK) {
                    TrafficManager.lockPipeline(creep.name, creep.id, hubLink.id, RESOURCE_ENERGY, amount, 'TRANSFER');
                    actionRegistered = true;
                }
            }
            // Priority 2: Dump to Terminal (if overflow conditions met)
            else if (terminal && terminalState.free > 0 && storageState.used > 100000 && !controllerNeedsEnergy && hubLinkState.used === 0) {
                 const amount = Math.min(creepState.used, terminalState.free);
                 if (TrafficManager.registerTransfer(creep, terminal, RESOURCE_ENERGY, amount) === OK) {
                     TrafficManager.lockPipeline(creep.name, creep.id, terminal.id, RESOURCE_ENERGY, amount, 'TRANSFER');
                     actionRegistered = true;
                 }
            }
            // Priority 3: Dump to Storage
            else if (storageState.free > 0) {
                const amount = Math.min(creepState.used, storageState.free);
                if (TrafficManager.registerTransfer(creep, storage, RESOURCE_ENERGY, amount) === OK) {
                    TrafficManager.lockPipeline(creep.name, creep.id, storage.id, RESOURCE_ENERGY, amount, 'TRANSFER');
                    actionRegistered = true;
                }
            }
            heap.state = 'transfer';
        } else if (creepState.free > 0) {
            // Priority 1: Empty Link (if controller doesn't need energy)
            if (!controllerNeedsEnergy && hubLinkState.used > 0) {
                const amount = Math.min(creepState.free, hubLinkState.used);
                if (TrafficManager.registerWithdraw(creep, hubLink, RESOURCE_ENERGY, amount) === OK) {
                    TrafficManager.lockPipeline(creep.name, creep.id, hubLink.id, RESOURCE_ENERGY, amount, 'WITHDRAW');
                    actionRegistered = true;
                }
            }
            // Priority 2: Pull from Storage to fill link
            else if (controllerNeedsEnergy && hubLinkState.free > 0 && storageState.used > 0) {
                const amount = Math.min(creepState.free, storageState.used);
                if (TrafficManager.registerWithdraw(creep, storage, RESOURCE_ENERGY, amount) === OK) {
                    TrafficManager.lockPipeline(creep.name, creep.id, storage.id, RESOURCE_ENERGY, amount, 'WITHDRAW');
                    actionRegistered = true;
                }
            }
            // Priority 3: Pull from Storage to fill Terminal
            else if (terminal && terminalState.free > 0 && storageState.used > 100000 && !controllerNeedsEnergy && hubLinkState.used === 0) {
                const amount = Math.min(creepState.free, storageState.used);
                if (TrafficManager.registerWithdraw(creep, storage, RESOURCE_ENERGY, amount) === OK) {
                    TrafficManager.lockPipeline(creep.name, creep.id, storage.id, RESOURCE_ENERGY, amount, 'WITHDRAW');
                    actionRegistered = true;
                }
            }
            heap.state = 'withdraw';
        }

        if (creepState.used === 0 && !actionRegistered) {
            heap.state = 'SLEEP';
        }

    }
}

module.exports = { run };