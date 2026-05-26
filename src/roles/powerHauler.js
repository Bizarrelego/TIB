const movement = require('../utils/movement');
const TrafficManager = require('../traffic/trafficManager');

/**
 * @file powerHauler.js
 * @description Hauls power from destroyed Power Banks back to the colony's terminal or storage.
 */

module.exports = {
    /**
     * Executes logic for powerHauler role.
     * @param {Room} room
     */
    run(room) {
        const roomCreeps = global.State.creepsByRoom.get(room.name);
        if (!roomCreeps) return;

        const haulers = roomCreeps.get('powerHauler');
        if (!haulers || haulers.length === 0) return;

        for (const creep of haulers) {
            try {
                if (creep.fatigue > 0 || TrafficManager.checkPipeline(creep.id)) continue;

                if (creep.store.getUsedCapacity() === 0 && creep.heap.state !== 'pickup') {
                    creep.heap.state = 'pickup';
                } else if (creep.store.getFreeCapacity() === 0 && creep.heap.state !== 'transfer') {
                    creep.heap.state = 'transfer';
                }

                if (!creep.heap.state) {
                    creep.heap.state = 'pickup';
                }

                if (creep.heap.state === 'pickup') {
                    const targetRoomName = creep.memory.targetRoom;
                    if (!targetRoomName) continue;

                    if (creep.room.name !== targetRoomName) {
                        movement.moveTo(creep, new RoomPosition(25, 25, targetRoomName));
                        continue;
                    }

                    // In target room, find power
                    let target = null;
                    let isWithdraw = false;
                    let targetAmount = 0;

                    // 1. Check Ruins
                    const ruins = global.State.ruinsByRoom.get(targetRoomName) || [];
                    for (const ruin of ruins) {
                        if (ruin.store && ruin.store.getUsedCapacity(RESOURCE_POWER) > 0) {
                            target = ruin;
                            isWithdraw = true;
                            targetAmount = ruin.store.getUsedCapacity(RESOURCE_POWER);
                            break;
                        }
                    }

                    // 2. Check Tombstones
                    if (!target) {
                        const tombstones = global.State.tombstonesByRoom.get(targetRoomName) || [];
                        for (const tomb of tombstones) {
                            if (tomb.store && tomb.store.getUsedCapacity(RESOURCE_POWER) > 0) {
                                target = tomb;
                                isWithdraw = true;
                                targetAmount = tomb.store.getUsedCapacity(RESOURCE_POWER);
                                break;
                            }
                        }
                    }

                    // 3. Check Dropped Resources
                    if (!target) {
                        const dropped = global.State.droppedByRoom.get(targetRoomName) || [];
                        for (const drop of dropped) {
                            if (drop.resourceType === RESOURCE_POWER) {
                                target = drop;
                                isWithdraw = false;
                                targetAmount = drop.amount;
                                break;
                            }
                        }
                    }

                    if (target) {
                        if (creep.pos.isNearTo(target)) {
                            const amount = Math.min(creep.store.getFreeCapacity(), targetAmount);
                            if (isWithdraw) {
                                TrafficManager.registerWithdraw(creep, target, RESOURCE_POWER, amount);
                            } else {
                                TrafficManager.registerPickup(creep, target, RESOURCE_POWER, amount);
                            }
                        } else {
                            movement.moveTo(creep, target);
                        }
                    } else {
                        // No power found. If we have some, go transfer. Otherwise wait near center.
                        if (creep.store.getUsedCapacity() > 0) {
                            creep.heap.state = 'transfer';
                        } else {
                            // Wait around the target ID if known, else center
                            if (creep.heap.targetId) {
                                const powerBank = Game.getObjectById(creep.heap.targetId);
                                if (powerBank && !creep.pos.inRangeTo(powerBank, 3)) {
                                    movement.moveTo(creep, powerBank);
                                }
                            } else if (!creep.pos.inRangeTo(25, 25, 5)) {
                                movement.moveTo(creep, new RoomPosition(25, 25, targetRoomName));
                            }
                        }
                    }

                } else if (creep.heap.state === 'transfer') {
                    const homeRoomName = creep.memory.homeRoom;
                    if (!homeRoomName) continue;

                    if (creep.room.name !== homeRoomName) {
                        movement.moveTo(creep, new RoomPosition(25, 25, homeRoomName));
                        continue;
                    }

                    // In home room, find Terminal or Storage
                    let target = null;
                    const structures = global.State.structuresByRoom.get(homeRoomName) || new Map();
                    const terminals = structures.get(STRUCTURE_TERMINAL) || new Map();

                    if (terminals instanceof Map) {
                        for (const term of terminals.values()) {
                            if (term.store.getFreeCapacity(RESOURCE_POWER) > 0) {
                                target = term;
                                break;
                            }
                        }
                    } else if (Array.isArray(terminals) && terminals.length > 0 && terminals[0].store.getFreeCapacity(RESOURCE_POWER) > 0) {
                        target = terminals[0];
                    }

                    if (!target) {
                        const storages = structures.get(STRUCTURE_STORAGE) || new Map();
                        if (storages instanceof Map) {
                            for (const store of storages.values()) {
                                if (store.store.getFreeCapacity(RESOURCE_POWER) > 0) {
                                    target = store;
                                    break;
                                }
                            }
                        } else if (Array.isArray(storages) && storages.length > 0 && storages[0].store.getFreeCapacity(RESOURCE_POWER) > 0) {
                            target = storages[0];
                        }
                    }

                    if (target) {
                        if (creep.pos.isNearTo(target)) {
                            TrafficManager.registerTransfer(creep, target, RESOURCE_POWER, creep.store.getUsedCapacity(RESOURCE_POWER));
                        } else {
                            movement.moveTo(creep, target);
                        }
                    } else {
                        // Fallback wait near center
                        if (!creep.pos.inRangeTo(25, 25, 5)) {
                            movement.moveTo(creep, new RoomPosition(25, 25, homeRoomName));
                        }
                    }
                }
            } catch (e) {
                console.log(`[powerHauler Error] Room ${room.name}, Creep ${creep.name}: ${e.stack}`);
            }
        }
    }
};
