const eventBus = require('../os/eventBus');
const TrafficManager = require('../traffic/trafficManager');

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
            let parkPos = null;
            if (storage) {
                parkPos = { x: storage.pos.x + 1, y: storage.pos.y, roomName: room.name };
            } else if (spawns.length > 0) {
                parkPos = { x: spawns[0].pos.x + 1, y: spawns[0].pos.y, roomName: room.name };
            }

            const needyStructures = [];
            for (let i = 0; i < spawns.length; i++) {
                if (spawns[i].store.getFreeCapacity(RESOURCE_ENERGY) > 0) needyStructures.push(spawns[i]);
            }
            for (let i = 0; i < extensions.length; i++) {
                if (extensions[i].store.getFreeCapacity(RESOURCE_ENERGY) > 0) needyStructures.push(extensions[i]);
            }

            const needsEmergencyRefill = needyStructures.length > 0 && storages.length > 0 && (spawns.every(s => s.store.getUsedCapacity(RESOURCE_ENERGY) === 0));

            for (let i = 0; i < fastFillers.length; i++) {
                const creep = fastFillers[i];
                creep.heap = creep.heap || {};

                if (parkPos) creep.heap.parkPos = parkPos;

                if (creep.heap.state !== 'filling' && creep.heap.state !== 'emptying') creep.heap.state = 'emptying';
                if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) creep.heap.state = 'filling';
                else if (creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) creep.heap.state = 'emptying';

                creep.heap.transferTargetId = null;
                creep.heap.withdrawTargetId = null;

                if (creep.heap.state === 'emptying') {
                    let target = null;
                    for (let j = 0; j < needyStructures.length; j++) {
                        const struct = needyStructures[j];
                        if (struct.store.getFreeCapacity(RESOURCE_ENERGY) > 0 && creep.pos.isNearTo(struct)) {
                            target = struct;
                            break;
                        }
                    }

                    if (!target && needyStructures.length > 0) target = needyStructures[0];

                    if (target) creep.heap.transferTargetId = target.id;
                } else {
                    if (storage && storage.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                        if (!(room.memory.restrictStorageOutflow && !needsEmergencyRefill)) {
                            creep.heap.withdrawTargetId = storage.id;
                        }
                    }
                }
            }
        }

        // HAULER ASSIGNMENT LOGIC
        if (haulers.length > 0) {
            for (let i = 0; i < haulers.length; i++) {
                const creep = haulers[i];
                creep.heap = creep.heap || {};

                if (creep.store.getFreeCapacity() > 0) {
                    creep.heap.state = 'pickup';
                    let dropId = creep.heap.dropId;
                    let target = dropId ? Game.getObjectById(dropId) : null;

                    if (!target || (target.amount === 0) || (target.store && target.store.getUsedCapacity(RESOURCE_ENERGY) === 0)) {
                        target = null;
                        const droppedEnergy = global.State.droppedEnergyByRoom.get(room.name) || [];
                        const tombstones = global.State.tombstonesByRoom.get(room.name) || [];
                        const ruins = global.State.ruinsByRoom.get(room.name) || [];

                        let minDistance = Infinity;
                        const checkTarget = (t) => {
                            const dist = Math.max(Math.abs(creep.pos.x - t.pos.x), Math.abs(creep.pos.y - t.pos.y));
                            if (dist < minDistance) {
                                minDistance = dist;
                                target = t;
                            }
                        };

                        for (let j = 0; j < droppedEnergy.length; j++) checkTarget(droppedEnergy[j]);
                        for (let j = 0; j < tombstones.length; j++) checkTarget(tombstones[j]);
                        for (let j = 0; j < ruins.length; j++) checkTarget(ruins[j]);

                        creep.heap.dropId = target ? target.id : null;
                    }
                } else {
                    creep.heap.state = 'transfer';
                    creep.heap.dropId = null;

                    let target = null;
                    for (let j = 0; j < spawns.length; j++) {
                        if (spawns[j].store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                            target = spawns[j];
                            break;
                        }
                    }
                    if (!target) {
                        for (let j = 0; j < extensions.length; j++) {
                            if (extensions[j].store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                                target = extensions[j];
                                break;
                            }
                        }
                    }

                    if (target) {
                        creep.heap.targetId = target.id;
                    } else if (room.controller) {
                        creep.heap.targetId = 'controller';
                    } else {
                        creep.heap.targetId = null;
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

                for (let i = 0; i < hubManagers.length; i++) {
                    const creep = hubManagers[i];
                    if (creep.fatigue > 0 || TrafficManager.checkPipeline(creep.id)) continue;

                    if (!(creep.heap instanceof Map)) {
                        creep.heap = new Map();
                    }

                    if (!creep.heap.has('parkPos')) {
                        creep.heap.set('parkPos', findParkPos(hubLink, storage, room));
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

module.exports = LogisticsManager;