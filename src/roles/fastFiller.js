const movement = require('../utils/movement');

function run(room) {
    const roomCreeps = global.State.creepsByRoom.get(room.name);
    if (!roomCreeps) return;

    const fastFillers = roomCreeps.get('fastFiller');
    if (!fastFillers || fastFillers.length === 0) return;

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

    for (let i = 0; i < fastFillers.length; i++) {
        const creep = fastFillers[i];
        try {
            if (creep.fatigue > 0) continue; // Fatigue gating

            if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
                if (source) {
                    if (creep.withdraw(source, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                        movement.moveTo(creep, source);
                    }
                }
            } else {
                const structuresMap = global.State.structuresByRoom.get(room.name);
                let target = null;
                let minDistance = Infinity;

                if (structuresMap) {
                    const spawns = structuresMap.get(STRUCTURE_SPAWN) || [];
                    for (let j = 0; j < spawns.length; j++) {
                        if (spawns[j].store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                            const dist = creep.pos.getRangeTo(spawns[j]);
                            if (dist < minDistance) {
                                minDistance = dist;
                                target = spawns[j];
                            }
                        }
                    }

                    const extensions = structuresMap.get(STRUCTURE_EXTENSION) || [];
                    for (let j = 0; j < extensions.length; j++) {
                        if (extensions[j].store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                            const dist = creep.pos.getRangeTo(extensions[j]);
                            if (dist < minDistance) {
                                minDistance = dist;
                                target = extensions[j];
                            }
                        }
                    }
                }

                if (target) {
                    if (creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                        movement.moveTo(creep, target);
                    }
                } else {
                    if (creep.store.getFreeCapacity(RESOURCE_ENERGY) > 0 && source) {
                        if (creep.withdraw(source, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                            movement.moveTo(creep, source);
                        }
                    } else {
                        const heapIsMap = creep.heap instanceof Map;
                        const parkPos = heapIsMap ? creep.heap.get('parkPos') : creep.heap.parkPos;
                        if (parkPos) {
                            movement.moveTo(creep, new RoomPosition(parkPos.x, parkPos.y, parkPos.roomName));
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
