/**
 * @file remoteHauler.js
 * @description Transports energy from a remote room back to the home colony.
 */

const movement = require('../utils/movement');

/**
 * Executes logic for remoteHauler role.
 * @param {Room} room The home room of the colony managing these creeps.
 */
function run(room) {
    const roomCreeps = global.State.creepsByRoom.get(room.name);
    if (!roomCreeps) return;

    const remoteHaulers = roomCreeps.get('remoteHauler');
    if (!remoteHaulers || remoteHaulers.length === 0) return;

    for (const creep of remoteHaulers) {
        try {
            if (creep.fatigue > 0) continue; // Fatigue gating

            const remoteRoomName = creep.memory.remoteRoom;
            const homeRoomName = creep.memory.homeRoom || room.name;

            if (!remoteRoomName || !homeRoomName) continue;

            if (creep.memory.hauling && creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
                creep.memory.hauling = false;
            }
            if (!creep.memory.hauling && creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
                creep.memory.hauling = true;
            }

            if (!creep.memory.hauling) {
                // We are not hauling, need to go to remote room to pick up energy
                if (creep.room.name !== remoteRoomName) {
                    const targetPos = new RoomPosition(25, 25, remoteRoomName);
                    movement.moveTo(creep, targetPos);
                    continue;
                }

                // In remote room, move off exit
                if (creep.pos.x === 0 || creep.pos.x === 49 || creep.pos.y === 0 || creep.pos.y === 49) {
                    const centerPos = new RoomPosition(25, 25, remoteRoomName);
                    movement.moveTo(creep, centerPos);
                    continue;
                }

                // Find energy to pick up
                // 1. containerId
                let containerId = creep.memory.containerId;
                if (!containerId) {
                    const structuresMap = global.State.structuresByRoom.get(creep.room.name);
                    if (structuresMap) {
                        const containers = structuresMap.get(STRUCTURE_CONTAINER) || [];
                        if (containers.length > 0) {
                            containerId = containers[0].id;
                            creep.memory.containerId = containerId;
                        }
                    }
                }

                let target = null;

                if (containerId) {
                    const container = Game.getObjectById(containerId);
                    if (container && container.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                        target = container;
                    }
                }

                // 2. Dropped energy
                if (!target) {
                    const droppedArray = global.State.droppedByRoom.get(creep.room.name) || [];
                    for (let i = 0; i < droppedArray.length; i++) {
                        const dropped = droppedArray[i];
                        if (dropped.resourceType === RESOURCE_ENERGY && dropped.amount > 0) {
                            if (!target || dropped.amount > target.amount) {
                                target = dropped; // Simple priority: largest pile
                            }
                        }
                    }
                }

                // 3. Tombstones
                if (!target) {
                    const tombstonesArray = global.State.tombstonesByRoom.get(creep.room.name) || [];
                    for (let i = 0; i < tombstonesArray.length; i++) {
                        const ts = tombstonesArray[i];
                        if (ts.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                            target = ts;
                            break;
                        }
                    }
                }

                // 4. Ruins
                if (!target) {
                    const ruinsArray = global.State.ruinsByRoom.get(creep.room.name) || [];
                    for (let i = 0; i < ruinsArray.length; i++) {
                        const ruin = ruinsArray[i];
                        if (ruin.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                            target = ruin;
                            break;
                        }
                    }
                }

                if (target) {
                    let result;
                    if (target instanceof Resource) {
                        result = creep.pickup(target);
                    } else {
                        result = creep.withdraw(target, RESOURCE_ENERGY);
                    }

                    if (result === ERR_NOT_IN_RANGE) {
                        movement.moveTo(creep, target);
                    }
                }
            } else {
                // We are hauling (have energy), need to drop it off at home
                if (creep.room.name !== homeRoomName) {
                    const targetPos = new RoomPosition(25, 25, homeRoomName);
                    movement.moveTo(creep, targetPos);
                    continue;
                }

                // In home room, move off exit
                if (creep.pos.x === 0 || creep.pos.x === 49 || creep.pos.y === 0 || creep.pos.y === 49) {
                    const centerPos = new RoomPosition(25, 25, homeRoomName);
                    movement.moveTo(creep, centerPos);
                    continue;
                }

                const structuresMap = global.State.structuresByRoom.get(homeRoomName);
                if (!structuresMap) continue;

                const restrictStorageOutflow = Game.rooms[homeRoomName] && Game.rooms[homeRoomName].memory.restrictStorageOutflow;
                const homeRoom = Game.rooms[homeRoomName];

                let target = null;

                const spawns = global.State.spawnsByRoom.get(homeRoomName) || [];
                const extensions = structuresMap.get(STRUCTURE_EXTENSION) || [];

                // Critically low check
                if (homeRoom && homeRoom.energyAvailable < homeRoom.energyCapacityAvailable) {
                    for (let i = 0; i < spawns.length; i++) {
                        if (spawns[i].store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                            target = spawns[i];
                            break;
                        }
                    }
                    if (!target) {
                        for (let i = 0; i < extensions.length; i++) {
                            if (extensions[i].store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                                target = extensions[i];
                                break;
                            }
                        }
                    }
                }

                if (!target && !restrictStorageOutflow) {
                    const storages = structuresMap.get(STRUCTURE_STORAGE) || [];
                    if (storages.length > 0 && storages[0].store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                        target = storages[0];
                    }
                }

                if (!target && !restrictStorageOutflow) {
                    const terminals = structuresMap.get(STRUCTURE_TERMINAL) || [];
                    if (terminals.length > 0 && terminals[0].store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                        target = terminals[0];
                    }
                }

                // Fallback to spawn/extension if storage/terminal are restricted or not found
                if (!target) {
                    for (let i = 0; i < spawns.length; i++) {
                        if (spawns[i].store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                            target = spawns[i];
                            break;
                        }
                    }
                    if (!target) {
                        for (let i = 0; i < extensions.length; i++) {
                            if (extensions[i].store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                                target = extensions[i];
                                break;
                            }
                        }
                    }
                }

                if (target) {
                    if (creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                        movement.moveTo(creep, target);
                    }
                }
            }

        } catch (e) {
            console.error(`[remoteHauler Error] Room ${room.name}, Creep ${creep.name}: ${e.stack}`);
        }
    }
}

module.exports = { run };
