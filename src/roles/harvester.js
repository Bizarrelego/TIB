/**
 * @file harvester.js
 * @description Blind execution role for stationary harvesting. Strictly follows Top-Down assignments from heap memory.
 */

const movement = require('../utils/movement');
const TrafficManager = require('../traffic/trafficManager');
const sourceSleep = require('../utils/sourceSleep');

module.exports = {
    /**
     * Executes logic for harvester role.
     * Expects creep.heap.targetId and creep.heap.dropId to be assigned by managers.
     * @param {Room} room
     */
    run(room) {
        const roomCreeps = global.State.creepsByRoom.get(room.name);
        if (!roomCreeps) return;

        const harvesters = roomCreeps.get('harvester');
        if (!harvesters || harvesters.length === 0) return;

        for (let i = 0; i < harvesters.length; i++) {
            const creep = harvesters[i];
            try {
                if (creep.fatigue > 0 || TrafficManager.checkPipeline(creep.id)) continue;

                const targetId = creep.heap.targetId;
                if (!targetId) continue;

                const target = Game.getObjectById(targetId);
                if (!target) {
                    creep.heap.targetId = null;
                    continue;
                }

                if (target.ticksToRegeneration !== undefined && sourceSleep.isSleeping(target)) {
                    continue;
                }

                if (!creep.heap.atOptimalSpot) {
                    let isAtOptimalSpot = false;
                    let optimalSpot = null;

                    if (global.State && global.State.miningSpotsByRoom) {
                        const roomSpots = global.State.miningSpotsByRoom.get(room.name);
                        if (roomSpots && roomSpots instanceof Map) {
                            optimalSpot = roomSpots.get(targetId);
                        }
                    } else {
                        const memoryRooms = Memory.rooms || {};
                        const roomMemory = memoryRooms[room.name] || {};
                        if (roomMemory.miningSpots && Array.isArray(roomMemory.miningSpots)) {
                            const spotEntry = roomMemory.miningSpots.find(entry => entry[0] === targetId);
                            if (spotEntry) {
                                optimalSpot = spotEntry[1];
                            }
                        }
                    }

                    if (optimalSpot) {
                        if (creep.pos.x === optimalSpot.x && creep.pos.y === optimalSpot.y) {
                            isAtOptimalSpot = true;
                        } else {
                            movement.moveTo(creep, new RoomPosition(optimalSpot.x, optimalSpot.y, room.name));
                            continue;
                        }
                    } else {
                        if (!creep.pos.isNearTo(target)) {
                            movement.moveTo(creep, target);
                            continue;
                        } else {
                            isAtOptimalSpot = true;
                        }
                    }

                    if (isAtOptimalSpot) {
                        creep.heap.atOptimalSpot = true;
                    } else {
                        continue;
                    }
                }

                // Zero-Pathing Drop Mining
                if (creep.store.getUsedCapacity() > 0) {
                    let hasLink = false;

                    const structuresByRoom = global.State.structuresByRoom ? global.State.structuresByRoom.get(room.name) : null;
                    if (structuresByRoom) {
                        const links = structuresByRoom.get(STRUCTURE_LINK);
                        if (links) {
                            for (const link of links.values()) {
                                if (Math.max(Math.abs(link.pos.x - creep.pos.x), Math.abs(link.pos.y - creep.pos.y)) <= 1) {
                                    if (TrafficManager.registerTransfer) {
                                        TrafficManager.registerTransfer(creep, link, RESOURCE_ENERGY);
                                    } else {
                                        creep.transfer(link, RESOURCE_ENERGY);
                                    }
                                    hasLink = true;
                                    break;
                                }
                            }
                        }
                    }

                    if (!hasLink) {
                        creep.drop(RESOURCE_ENERGY);
                    }
                }

                TrafficManager.registerHarvest(creep, target);
            } catch (e) {
                console.log(`[Harvester Error] Room ${room.name}, Creep ${creep.name}: ${e.stack}`);
            }
        }
    }
};