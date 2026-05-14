const TrafficManager = require('../traffic/trafficManager');
const HubManager = require('../managers/HubManager');

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
        HubManager.run(roomName);
    }
};

module.exports = LogisticsManager;