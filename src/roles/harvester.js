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

                const dropId = creep.heap.dropId;
                let dropPos = creep.heap.dropPos;

                if (!dropPos && dropId !== undefined && dropId !== null) {
                    if (typeof dropId === 'number') {
                        // Decode 50x + y coordinate
                        const x = Math.floor(dropId / 50);
                        const y = dropId % 50;
                        dropPos = new RoomPosition(x, y, room.name);
                        creep.heap.dropPos = dropPos;
                    } else if (typeof dropId === 'string') {
                        const dropTarget = Game.getObjectById(dropId);
                        if (dropTarget) {
                            dropPos = dropTarget.pos;
                            creep.heap.dropPos = dropPos;
                        }
                    }
                }

                if (dropPos && (creep.pos.x !== dropPos.x || creep.pos.y !== dropPos.y)) {
                    movement.moveTo(creep, dropPos);
                    continue;
                } else if (!dropPos && !creep.pos.isNearTo(target)) {
                    movement.moveTo(creep, target);
                    continue;
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
                        const storage = room.storage;
                        // If storage exists and we are in primary room, we terminate drop mining and rely on links/haulers to clear our inventory
                        if (!storage) {
                            creep.drop(RESOURCE_ENERGY);
                        }
                    }
                }

                TrafficManager.registerHarvest(creep, target);
            } catch (e) {
                console.log(`[Harvester Error] Room ${room.name}, Creep ${creep.name}: ${e.stack}`);
            }
        }
    }
};