const TrafficManager = require('../traffic/trafficManager');
const movement = require('../utils/movement');

function run(room) {
    const roomCreeps = global.State.creepsByRoom.get(room.name);
    if (!roomCreeps) return;

    const fastFillers = roomCreeps.get('fastFiller');
    if (!fastFillers || fastFillers.length === 0) return;

    const plannerState = global.State.roomPlanner ? global.State.roomPlanner.get(room.name) : null;
    const fastFillerPositions = plannerState ? plannerState.get('fastFillerPositions') : null;

    if (!fastFillerPositions || fastFillerPositions.length === 0) return;

    const storage = room.storage && room.storage.isActive() ? room.storage : null;
    let coreContainer = null;

    if (!storage) {
        const structuresMap = global.State.structuresByRoom.get(room.name);
        const containers = structuresMap ? (structuresMap.get(STRUCTURE_CONTAINER) || []) : [];
        const spawns = structuresMap ? (structuresMap.get(STRUCTURE_SPAWN) || []) : [];
        if (spawns.length > 0) {
            for (let i = 0; i < containers.length; i++) {
                if (containers[i].pos.inRangeTo(spawns[0], 2)) {
                    coreContainer = containers[i];
                    break;
                }
            }
        }
    }

    const source = storage || coreContainer;

    // Fast fillers are stationary. Claim a position.
    const claimedPositions = new Set();
    for (let i = 0; i < fastFillers.length; i++) {
        const creep = fastFillers[i];
        if (creep.memory.targetPos) {
            claimedPositions.add(`${creep.memory.targetPos.x},${creep.memory.targetPos.y}`);
        }
    }

    for (let i = 0; i < fastFillers.length; i++) {
        const creep = fastFillers[i];
        try {
            if (creep.fatigue > 0) continue;

            if (!creep.memory.targetPos) {
                for (let j = 0; j < fastFillerPositions.length; j++) {
                    const pos = fastFillerPositions[j];
                    const key = `${pos.x},${pos.y}`;
                    if (!claimedPositions.has(key)) {
                        creep.memory.targetPos = { x: pos.x, y: pos.y, roomName: pos.roomName };
                        claimedPositions.add(key);
                        break;
                    }
                }
            }

            if (!creep.memory.targetPos) continue;

            const targetPos = new RoomPosition(creep.memory.targetPos.x, creep.memory.targetPos.y, creep.memory.targetPos.roomName);

            // If not on spot, move to it.
            if (creep.pos.x !== targetPos.x || creep.pos.y !== targetPos.y) {
                movement.moveTo(creep, targetPos);
                continue;
            }

            // Once on spot, execute strictly stationary calls.
            TrafficManager.registerStatic(creep);

            if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
                // Pickup from floor if dropped by haulers or withdraw from core
                if (storage && creep.pos.isNearTo(storage) && storage.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                    creep.withdraw(storage, RESOURCE_ENERGY);
                } else if (!storage && source && creep.pos.isNearTo(source) && source.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                    creep.withdraw(source, RESOURCE_ENERGY);
                } else if (!storage) {
                    const dropped = global.State.droppedByRoom.get(room.name);
                    if (dropped) {
                        for (const drop of dropped.values()) {
                            if (drop.resourceType === RESOURCE_ENERGY && creep.pos.isEqualTo(drop.pos)) {
                                creep.pickup(drop);
                                break;
                            }
                        }
                    }
                }
            } else {
                const structuresMap = global.State.structuresByRoom.get(room.name);
                let target = null;

                if (structuresMap) {
                    const extensions = structuresMap.get(STRUCTURE_EXTENSION);
                    if (extensions) {
                        for (const ext of extensions.values()) {
                            if (creep.pos.isNearTo(ext) && ext.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                                target = ext;
                                break;
                            }
                        }
                    }
                    if (!target) {
                        const spawns = structuresMap.get(STRUCTURE_SPAWN);
                        if (spawns) {
                            for (const sp of spawns.values()) {
                                if (creep.pos.isNearTo(sp) && sp.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                                    target = sp;
                                    break;
                                }
                            }
                        }
                    }
                }

                if (target && target.store && target.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
                    if (creep.heap) creep.heap.targetId = null;
                    target = null;
                }
                if (target) {
                    creep.transfer(target, RESOURCE_ENERGY);
                } else {
                    // Refill if empty, otherwise wait.
                    if (creep.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                        if (storage && creep.pos.isNearTo(storage) && storage.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                            creep.withdraw(storage, RESOURCE_ENERGY);
                        } else if (!storage) {
                            const dropped = global.State.droppedByRoom.get(room.name);
                            if (dropped) {
                                for (const drop of dropped.values()) {
                                    if (drop.resourceType === RESOURCE_ENERGY && creep.pos.isEqualTo(drop.pos)) {
                                        creep.pickup(drop);
                                        break;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        } catch (e) {
            console.log(`[fastFiller Error] Room ${room.name}, Creep ${creep.name}: ${e.stack}`);
        }
    }
}

module.exports = { run };
