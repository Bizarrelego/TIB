const eventBus = require('../os/eventBus');
const TrafficManager = require('../traffic/trafficManager');

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

const HubManager = {
    run(roomName) {
        if (!global.State.structuresByRoom.has(roomName)) return;

        const room = Game.rooms[roomName];
        if (!room) return;

        const structuresMap = global.State.structuresByRoom.get(roomName) || new Map();
        const roomCreeps = global.State.creepsByRoom.get(roomName) || new Map();

        const storages = structuresMap.get(STRUCTURE_STORAGE) || [];
        const storage = storages[0];

        const links = structuresMap.get(STRUCTURE_LINK) || [];
        const terminals = structuresMap.get(STRUCTURE_TERMINAL) || [];
        const terminal = terminals[0];

        const hubManagers = roomCreeps.get('hubManager') || [];

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

module.exports = HubManager;
