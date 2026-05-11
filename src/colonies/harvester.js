const movement = require('../utils/movement');

module.exports = {
    run: function(room) {
        const roomCreeps = global.State.creepsByRoom.get(room.name);
        if (!roomCreeps) return;

        const harvesters = roomCreeps.get('harvester');
        if (!harvesters) return;

        for (const creep of harvesters) {
            try {
                let targetId = creep.heap.targetId;
                if (!targetId) {
                    const sources = global.State.sourcesByRoom.get(room.name) || [];
                    if (sources.length > 0) {
                        // Ensure one harvester per source.
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
                            const nearestSource = creep.pos.findClosestByRange(sources);
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
                        if (creep.harvest(target) === ERR_NOT_IN_RANGE) {
                            movement.moveTo(creep, target);
                        } else {
                            // Already in range and harvesting. Check if full.
                            if (creep.store.getFreeCapacity() === 0) {
                                creep.drop(RESOURCE_ENERGY);
                            }
                        }
                    } else {
                        // Target invalid, reset
                        creep.heap.targetId = null;
                    }
                }
            } catch (e) {
                console.log(`[Harvester Error] Room ${room.name}, Creep ${creep.name}: ${e.stack}`);
            }
        }
    }
};
