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

        const transporterCount = (roomCreeps.get('hauler') ? roomCreeps.get('hauler').length : 0) +
                            (roomCreeps.get('domesticHauler') ? roomCreeps.get('domesticHauler').length : 0) +
                            (roomCreeps.get('worker') ? roomCreeps.get('worker').length : 0);

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
                        // Handle Emergency/Bootstrap Delivery Mode
                        if (transporterCount === 0) {
                            if (creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
                                creep.heap.deliveryMode = true;
                            } else if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
                                creep.heap.deliveryMode = false;
                            }
                        } else {
                            creep.heap.deliveryMode = false;
                        }

                        if (creep.heap.deliveryMode) {
                            const isRoomFull = room.energyAvailable >= room.energyCapacityAvailable;
                            if (creep.store.getFreeCapacity() === 0 && isRoomFull) {
                                if (creep.pos.getRangeTo(room.controller) > 3) {
                                    movement.moveTo(creep, room.controller);
                                } else {
                                    creep.upgradeController(room.controller);
                                }
                                continue;
                            }

                            const roomStructures = global.State.structuresByRoom.get(room.name);
                            const targets = [];
                            if (roomStructures) {
                                const spawns = roomStructures.get(STRUCTURE_SPAWN);
                                if (spawns) {
                                    for (const spawn of spawns.values()) {
                                        if (TrafficManager.getVirtualState(spawn, RESOURCE_ENERGY).free > 0) targets.push(spawn);
                                    }
                                }
                                const extensions = roomStructures.get(STRUCTURE_EXTENSION);
                                if (extensions) {
                                    for (const ext of extensions.values()) {
                                        if (TrafficManager.getVirtualState(ext, RESOURCE_ENERGY).free > 0) targets.push(ext);
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
                                    if (nearest.store && nearest.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
                                        if (creep.pos.getRangeTo(room.controller) > 3) {
                                            movement.moveTo(creep, room.controller);
                                        } else {
                                            creep.upgradeController(room.controller);
                                        }
                                    } else if (!creep.pos.isNearTo(nearest)) {
                                        movement.moveTo(creep, nearest);
                                    } else {
                                        const amount = Math.min(creep.store.getUsedCapacity(RESOURCE_ENERGY), TrafficManager.getVirtualState(nearest, RESOURCE_ENERGY).free);
                                        if (amount > 0) {
                                            TrafficManager.registerTransfer(creep, nearest, RESOURCE_ENERGY, amount);
                                        }
                                    }
                                }
                            } else if (room.controller) {
                                // If no targets need energy, upgrade controller so we don't stall
                                if (creep.pos.getRangeTo(room.controller) > 3) {
                                    movement.moveTo(creep, room.controller);
                                } else {
                                    creep.upgradeController(room.controller);
                                }
                            }
                            continue; // Skip normal parking and harvesting
                        }

                        let parkingSpot = null;

                        // Find a container or container site near the source
                        const structures = global.State.structuresByRoom.get(room.name);
                        const containers = structures ? (structures.get(STRUCTURE_CONTAINER) || new Map()) : new Map();
                        const sites = global.State.sitesByRoom.get(room.name) || [];

                        for (const container of containers.values()) {
                            if (container.pos.isNearTo(target)) {
                                parkingSpot = container;
                                break;
                            }
                        }

                        if (!parkingSpot) {
                            for (let i = 0; i < sites.length; i++) {
                                if (sites[i].structureType === STRUCTURE_CONTAINER && sites[i].pos.isNearTo(target)) {
                                    parkingSpot = sites[i];
                                    break;
                                }
                            }
                        }

                        // If parking spot exists and we are not on it, move to it.
                        if (parkingSpot && !creep.pos.isEqualTo(parkingSpot.pos)) {
                            movement.moveTo(creep, parkingSpot);
                        } else if (!creep.pos.isNearTo(target)) {
                            movement.moveTo(creep, target);
                        } else {
                            if (creep.store.getFreeCapacity() === 0) {
                                if (parkingSpot && parkingSpot.structureType === STRUCTURE_CONTAINER) {
                                    // if sitting on container, do not drop or transfer. the engine drops when full if we try to harvest.
                                } else {
                                    // Just drop it if no container exists
                                    TrafficManager.registerDrop(creep, RESOURCE_ENERGY, creep.store.getUsedCapacity(RESOURCE_ENERGY));
                                }
                            }
                            TrafficManager.registerHarvest(creep, target);
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