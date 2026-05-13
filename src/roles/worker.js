/**
 * @file worker.js
 * @description Multi-tool fallback (Harvest/Build/Upgrade). Replaced by dedicated roles.
 */

const movement = require('../utils/movement');

module.exports = {
    /**
     * Executes logic for worker role.
     * @param {Room} room
     */
    run(room) {
        const roomCreeps = global.State.creepsByRoom.get(room.name);
        if (!roomCreeps) return;

        const workers = roomCreeps.get('worker');
        if (!workers || workers.length === 0) return;

        for (const creep of workers) {
            try {
                if (creep.fatigue > 0) continue; // Fatigue gating

                creep.heap = creep.heap || {};

                if (creep.heap.state !== 'harvesting' && creep.store.getUsedCapacity() === 0) {
                    creep.heap.state = 'harvesting';
                    creep.heap.targetId = null;
                }
                if (creep.heap.state === 'harvesting' && creep.store.getFreeCapacity() === 0) {
                    creep.heap.state = 'working';
                    creep.heap.targetId = null;
                }

                if (creep.heap.state === 'harvesting') {
                    // Find dropped energy or source
                    let target = null;
                    if (creep.heap.targetId) {
                        target = Game.getObjectById(creep.heap.targetId);
                    }
                    if (!target) {
                        const dropped = global.State.droppedByRoom.get(room.name);
                        if (dropped && dropped.length > 0) {
                            target = dropped[0];
                        } else {
                            target = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
                        }
                        if (target) creep.heap.targetId = target.id;
                    }

                    if (target) {
                        if (creep.pos.isNearTo(target)) {
                            if (target instanceof Resource) {
                                creep.pickup(target);
                            } else {
                                creep.harvest(target);
                            }
                        } else {
                            movement.moveTo(creep, target);
                        }
                    }
                } else {
                    // Working: Build, then Upgrade, then Store
                    let target = null;
                    if (creep.heap.targetId) {
                        target = Game.getObjectById(creep.heap.targetId);
                    }

                    if (!target || (target.structureType && target.store && target.store.getFreeCapacity(RESOURCE_ENERGY) === 0)) {
                        const sites = global.State.sitesByRoom.get(room.name);
                        let sitesArray = [];
                        if (sites) {
                            if (Array.isArray(sites)) {
                                sitesArray = sites;
                            } else if (sites instanceof Map) {
                                sitesArray = Array.from(sites.values());
                            }
                        }
                        if (sitesArray.length > 0) {
                            target = sitesArray[0];
                        } else {
                            target = room.controller;
                        }
                        if (target) creep.heap.targetId = target.id;
                    }

                    if (target) {
                        if (creep.pos.inRangeTo(target, 3)) {
                            if (target instanceof ConstructionSite) {
                                creep.build(target);
                            } else if (target instanceof StructureController) {
                                creep.upgradeController(target);
                            }
                        } else {
                            movement.moveTo(creep, target);
                        }
                    }
                }
            } catch (e) {
                console.error(`[worker Error] Room ${room.name}, Creep ${creep.name}: ${e.stack}`);
            }
        }
    }
};
