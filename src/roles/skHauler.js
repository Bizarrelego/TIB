const movement = require('../utils/movement');
const TrafficManager = require('../traffic/trafficManager');

/**
 * @file skHauler.js
 * @description Hauler for SK sectors. Picks up dropped energy and returns it to the home room.
 */

module.exports = {
    /**
     * Executes logic for skHauler role.
     * @param {Room} room
     */
    run(room) {
        const roomCreeps = global.State.creepsByRoom.get(room.name) || new Map();
        const haulers = roomCreeps.get('skHauler') || [];
        if (haulers.length === 0) return;

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

                    // In target room, find dropped energy
                    const droppedResources = global.State.droppedByRoom.get(targetRoomName) || [];
                    let bestEnergy = null;
                    let maxAmount = 0;

                    for (const resource of droppedResources) {
                        if (resource.resourceType === RESOURCE_ENERGY && resource.amount > maxAmount) {
                            maxAmount = resource.amount;
                            bestEnergy = resource;
                        }
                    }

                    if (bestEnergy) {
                        if (creep.pos.isNearTo(bestEnergy)) {
                            TrafficManager.registerPickup(creep, bestEnergy, RESOURCE_ENERGY, Math.min(creep.store.getFreeCapacity(), bestEnergy.amount));
                        } else {
                            movement.moveTo(creep, bestEnergy);
                        }
                    } else {
                        // Fallback: move to center if no energy found
                        if (!creep.pos.inRangeTo(25, 25, 10)) {
                            movement.moveTo(creep, new RoomPosition(25, 25, targetRoomName));
                        }
                    }

                } else if (creep.heap.state === 'transfer') {
                    const homeRoomName = creep.memory.homeRoom;
                    if (!homeRoomName) continue;

                    const homeRoom = global.State.rooms.get(homeRoomName);
                    if (!homeRoom || creep.room.name !== homeRoomName) {
                        movement.moveTo(creep, new RoomPosition(25, 25, homeRoomName));
                        continue;
                    }

                    // In home room, transfer to storage
                    const storage = homeRoom.storage;
                    if (storage) {
                        if (creep.pos.isNearTo(storage)) {
                            TrafficManager.registerTransfer(creep, storage, RESOURCE_ENERGY, creep.store.getUsedCapacity(RESOURCE_ENERGY));
                        } else {
                            movement.moveTo(creep, storage);
                        }
                    } else {
                        // Fallback if no storage
                        if (homeRoom.controller) {
                             if (creep.pos.inRangeTo(homeRoom.controller, 3)) {
                                 creep.drop(RESOURCE_ENERGY);
                             } else {
                                 movement.moveTo(creep, homeRoom.controller);
                             }
                        }
                    }
                }

            } catch (e) {
                console.log(`[skHauler Error] Room ${room.name}, Creep ${creep.name}: ${e.stack}`);
            }
        }
    }
};
