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

                if (creep.store.getFreeCapacity() > 0) {
                    // Harvest mode
                    let targetId = creep.heap.targetId;
                    if (!targetId) {
                        const sources = global.State.sourcesByRoom.get(room.name) || [];
                        if (sources.length > 0) {
                            // Find nearest source
                            const nearestSource = creep.pos.findClosestByRange(sources);
                            if (nearestSource) {
                                targetId = nearestSource.id;
                                creep.heap.targetId = targetId;
                            }
                        }
                    }

                    if (targetId) {
                        const target = Game.getObjectById(targetId);
                        if (target) {
                            if (creep.harvest(target) === ERR_NOT_IN_RANGE) {
                                movement.moveTo(creep, target);
                            }
                        } else {
                            // Target invalid, reset
                            creep.heap.targetId = null;
                        }
                    }
                } else {
                    // Spawn refill, Build & Upgrade mode
                    if (room.energyAvailable < room.energyCapacityAvailable) {
                        const structures = global.State.structuresByRoom.get(room.name);
                        let target = null;
                        if (structures) {
                            const spawns = structures.get(STRUCTURE_SPAWN) || [];
                            for (let i = 0; i < spawns.length; i++) {
                                if (spawns[i].store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                                    target = spawns[i];
                                    break;
                                }
                            }
                            if (!target) {
                                const extensions = structures.get(STRUCTURE_EXTENSION) || [];
                                for (let i = 0; i < extensions.length; i++) {
                                    if (extensions[i].store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                                        target = extensions[i];
                                        break;
                                    }
                                }
                            }
                        }

                        if (target) {
                            const result = creep.transfer(target, RESOURCE_ENERGY);
                            if (result === ERR_NOT_IN_RANGE) {
                                movement.moveTo(creep, target);
                            }
                        } else {
                            // Target to build
                            const sites = global.State.sitesByRoom.get(room.name);
                            if (sites && sites.length > 0) {
                                if (creep.build(sites[0]) === ERR_NOT_IN_RANGE) {
                                    movement.moveTo(creep, sites[0]);
                                }
                            } else if (room.controller) {
                                if (creep.upgradeController(room.controller) === ERR_NOT_IN_RANGE) {
                                    movement.moveTo(creep, room.controller);
                                }
                            }
                        }
                    } else {
                        const sites = global.State.sitesByRoom.get(room.name);
                        if (sites && sites.length > 0) {
                            if (creep.build(sites[0]) === ERR_NOT_IN_RANGE) {
                                movement.moveTo(creep, sites[0]);
                            }
                        } else if (room.controller) {
                            if (creep.upgradeController(room.controller) === ERR_NOT_IN_RANGE) {
                                movement.moveTo(creep, room.controller);
                            }
                        }
                    }
                }
            } catch (e) {
                console.error(`[worker Error] Room ${room.name}, Creep ${creep.name}: ${e.stack}`);
            }
        }
    }
};
