const movement = require('../utils/movement');

function run(room) {
    const roomCreeps = global.State.creepsByRoom.get(room.name);
    if (!roomCreeps) return;

    const fastFillers = roomCreeps.get('fastFiller');
    if (!fastFillers) return;

    for (let i = 0; i < fastFillers.length; i++) {
        const creep = fastFillers[i];
        try {
            creep.heap = creep.heap || {};
            if (creep.fatigue > 0) continue; // Fatigue gating

            // State Machine
            if (creep.heap.state !== 'filling' && creep.heap.state !== 'emptying') {
                creep.heap.state = 'emptying';
            }
            if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
                creep.heap.state = 'filling';
            } else if (creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
                creep.heap.state = 'emptying';
            }

            // Stationary Logic (calculate parkPos)
            if (!creep.heap.parkPos) {
                const structures = global.State.structuresByRoom.get(room.name);
                let storage = null;
                if (structures) {
                    const storages = structures.get(STRUCTURE_STORAGE) || [];
                    if (storages.length > 0) storage = storages[0];
                }

                if (storage) {
                    // Find a spot adjacent to Storage and Spawn. We'll use the storage itself as anchor and pick an empty spot,
                    // or just hardcode near spawn if possible.
                    // The StorageManager places storage at (spawn.x, spawn.y - 1).
                    // A good spot is (spawn.x, spawn.y + 1) or next to storage (spawn.x + 1, spawn.y - 1).
                    // We will just try to park at (storage.pos.x + 1, storage.pos.y).
                    creep.heap.parkPos = { x: storage.pos.x + 1, y: storage.pos.y, roomName: room.name };
                } else {
                    const spawns = global.State.spawnsByRoom.get(room.name);
                    if (spawns && spawns.length > 0) {
                        creep.heap.parkPos = { x: spawns[0].pos.x + 1, y: spawns[0].pos.y, roomName: room.name };
                    }
                }
            }

            // Move to parkPos if not there
            if (creep.heap.parkPos) {
                if (creep.pos.x !== creep.heap.parkPos.x || creep.pos.y !== creep.heap.parkPos.y) {
                    movement.moveTo(creep, new RoomPosition(creep.heap.parkPos.x, creep.heap.parkPos.y, creep.heap.parkPos.roomName));
                    continue; // Wait until arrived
                }
            }

            if (creep.heap.state === 'emptying') {
                // Emptying (Transferring)
                let targetId = creep.heap.transferTargetId;
                let target = targetId ? Game.getObjectById(targetId) : null;

                // If invalid target or target full or target out of range, find new one
                if (!target || target.store.getFreeCapacity(RESOURCE_ENERGY) === 0 || !creep.pos.isNearTo(target)) {
                    const structures = global.State.structuresByRoom.get(room.name);
                    target = null;
                    if (structures) {
                        const spawns = structures.get(STRUCTURE_SPAWN) || [];
                        for (let j = 0; j < spawns.length; j++) {
                            if (spawns[j].store.getFreeCapacity(RESOURCE_ENERGY) > 0 && creep.pos.isNearTo(spawns[j])) {
                                target = spawns[j];
                                break;
                            }
                        }
                        if (!target) {
                            const extensions = structures.get(STRUCTURE_EXTENSION) || [];
                            for (let j = 0; j < extensions.length; j++) {
                                if (extensions[j].store.getFreeCapacity(RESOURCE_ENERGY) > 0 && creep.pos.isNearTo(extensions[j])) {
                                    target = extensions[j];
                                    break;
                                }
                            }
                        }
                    }

                    if (target) {
                        creep.heap.transferTargetId = target.id;
                    } else {
                        creep.heap.transferTargetId = null;
                    }
                }

                if (target) {
                    creep.transfer(target, RESOURCE_ENERGY);
                }

            } else {
                // Filling (Withdrawing)
                let targetId = creep.heap.withdrawTargetId;
                let target = targetId ? Game.getObjectById(targetId) : null;

                if (!target || target.store.getUsedCapacity(RESOURCE_ENERGY) === 0 || !creep.pos.isNearTo(target)) {
                    const structures = global.State.structuresByRoom.get(room.name);
                    target = null;
                    if (structures) {
                        const storages = structures.get(STRUCTURE_STORAGE) || [];
                        if (storages.length > 0 && storages[0].store.getUsedCapacity(RESOURCE_ENERGY) > 0 && creep.pos.isNearTo(storages[0])) {
                            target = storages[0];
                        }
                    }

                    if (target) {
                        creep.heap.withdrawTargetId = target.id;
                    } else {
                        creep.heap.withdrawTargetId = null;
                    }
                }

                if (target) {
                    // Respect DEFCON outflow restriction
                    if (room.memory.restrictStorageOutflow) {
                        const structures = global.State.structuresByRoom.get(room.name);
                        let needsEmergencyRefill = false;
                        if (structures) {
                            const spawns = structures.get(STRUCTURE_SPAWN) || [];
                            for (let j = 0; j < spawns.length; j++) {
                                if (spawns[j].store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
                                    needsEmergencyRefill = true;
                                    break;
                                }
                            }
                        }
                        if (!needsEmergencyRefill) {
                            continue; // Wait out the alert
                        }
                    }

                    creep.withdraw(target, RESOURCE_ENERGY);
                }
            }
        } catch (e) {
            console.log(`[fastFiller Error] Room ${room.name}, Creep ${creep.name}: ${e.stack}`);
        }
    }
}

module.exports = { run };
