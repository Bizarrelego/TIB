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
                        if (creep.harvest(target) === ERR_NOT_IN_RANGE) {
                            movement.moveTo(creep, target);
                        } else {
                            if (creep.store.getFreeCapacity() === 0) {
                                creep.drop(RESOURCE_ENERGY);
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