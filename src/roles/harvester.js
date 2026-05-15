const movement = require('../utils/movement');
const TrafficManager = require('../traffic/trafficManager');

module.exports = {
    run: function(room) {
        const roomCreeps = global.State.creepsByRoom.get(room.name);
        if (!roomCreeps) return;

        const harvesters = roomCreeps.get('harvester');
        if (!harvesters) return;

        let sources = global.State.sourcesByRoom.get(room.name);
        if (!sources || sources.length === 0) {
            return;
        }

        const haulerCount = (roomCreeps.get('hauler') ? roomCreeps.get('hauler').length : 0) +
                            (roomCreeps.get('domesticHauler') ? roomCreeps.get('domesticHauler').length : 0);

        for (const creep of harvesters) {
            try {
                let targetId = creep.heap.targetId;
                if (!targetId) {
                    if (sources.length > 0) {
                        const assignedSources = new Set();
                        for (const h of harvesters) {
                            if (h.heap && h.heap.targetId) {
                                assignedSources.add(h.heap.targetId);
                            }
                        }

                        const unminedSource = sources.find(s => !assignedSources.has(s.id));
                        if (unminedSource) {
                            targetId = unminedSource.id;
                            creep.heap.targetId = targetId;
                        } else {
                            let nearestSource = null;
                            let minDistance = Infinity;
                            for (let i = 0; i < sources.length; i++) {
                                const dist = Math.max(Math.abs(creep.pos.x - sources[i].pos.x), Math.abs(creep.pos.y - sources[i].pos.y));
                                if (dist < minDistance) {
                                    minDistance = dist;
                                    nearestSource = sources[i];
                                }
                            }

                            if (nearestSource) {
                                targetId = nearestSource.id;
                                creep.heap.targetId = targetId;
                            }
                        }
                    }
                }

                if (targetId) {
                    const target = Game.getObjectById(targetId);
                    if (target) {
                        if (creep.store.getFreeCapacity() === 0) {
                            if (haulerCount === 0) {
                                const roomStructures = global.State.structuresByRoom.get(room.name);
                                const targets = [];
                                if (roomStructures) {
                                    const spawns = roomStructures.get(STRUCTURE_SPAWN);
                                    if (spawns) {
                                        for (const spawn of spawns.values()) {
                                            if (spawn.store.getFreeCapacity(RESOURCE_ENERGY) > 0) targets.push(spawn);
                                        }
                                    }
                                    const extensions = roomStructures.get(STRUCTURE_EXTENSION);
                                    if (extensions) {
                                        for (const ext of extensions.values()) {
                                            if (ext.store.getFreeCapacity(RESOURCE_ENERGY) > 0) targets.push(ext);
                                        }
                                    }
                                }
                                if (targets.length > 0) {
                                    let nearest = null;
                                    let minPathLen = Infinity;
                                    for (let i = 0; i < targets.length; i++) {
                                        const dist = creep.pos.getRangeTo(targets[i]);
                                        if (dist < minPathLen) {
                                            minPathLen = dist;
                                            nearest = targets[i];
                                        }
                                    }
                                    if (nearest) {
                                        if (!creep.pos.isNearTo(nearest)) {
                                            movement.moveTo(creep, nearest);
                                        } else {
                                            TrafficManager.registerTransfer(creep, nearest, RESOURCE_ENERGY, creep.store.getUsedCapacity(RESOURCE_ENERGY));
                                        }
                                    }
                                }
                            } else {
                                TrafficManager.registerDrop(creep, RESOURCE_ENERGY, creep.store.getUsedCapacity(RESOURCE_ENERGY));
                            }
                        } else {
                            if (!creep.pos.isNearTo(target)) {
                                movement.moveTo(creep, target);
                            } else {
                                TrafficManager.registerHarvest(creep, target);
                            }
                        }
                    } else {
                        creep.heap.targetId = null;
                    }
                }
            } catch (e) {
                console.log(`[Harvester Error] Room ${room.name}, Creep ${creep.name}: ${e.stack}`);
            }
        }
    }
};