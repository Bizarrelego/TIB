module.exports = {
    run: function(room) {
        const roomCreeps = global.State.creepsByRoom.get(room.name);
        if (!roomCreeps) return;

        const workers = roomCreeps.get('worker');
        if (!workers) return;

        for (const creep of workers) {
            try {
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
                                creep.moveTo(target);
                            }
                        } else {
                            // Target invalid, reset
                            creep.heap.targetId = null;
                        }
                    }
                } else {
                    // Spawn refill & Upgrade mode
                    if (room.energyAvailable < room.energyCapacityAvailable) {
                        const spawns = global.State.spawnsByRoom.get(room.name) || [];
                        const spawn = spawns.length > 0 ? spawns[0] : null;
                        if (spawn) {
                            const result = creep.transfer(spawn, RESOURCE_ENERGY);
                            if (result === ERR_NOT_IN_RANGE) {
                                creep.moveTo(spawn);
                            } else if (result === ERR_FULL && room.controller) {
                                if (creep.upgradeController(room.controller) === ERR_NOT_IN_RANGE) {
                                    creep.moveTo(room.controller);
                                }
                            }
                        } else if (room.controller) {
                            if (creep.upgradeController(room.controller) === ERR_NOT_IN_RANGE) {
                                creep.moveTo(room.controller);
                            }
                        }
                    } else if (room.controller) {
                        if (creep.upgradeController(room.controller) === ERR_NOT_IN_RANGE) {
                            creep.moveTo(room.controller);
                        }
                    }
                }
            } catch (e) {
                console.log(`[Economy Error] Room ${room.name}, Creep ${creep.name}: ${e.stack}`);
            }
        }
    }
};
