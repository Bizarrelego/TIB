const STRUCTURE_PRIORITIES = require('../constants/structurePriorities');

module.exports = {
    /**
     * Executes Top-Down Assignment for workers.
     * Evaluates room state and assigns tasks directly to creep.heap.
     * @param {Room} room
     */
    run(room) {
        const roomCreeps = global.State.creepsByRoom.get(room.name);
        if (!roomCreeps) return;

        const workers = roomCreeps.get('worker');
        if (!workers || workers.length === 0) return;

        const sources = global.State.sourcesByRoom.get(room.name) || [];
        const structures = global.State.structuresByRoom.get(room.name);
        const sites = global.State.sitesByRoom.get(room.name);

        let refillTargets = [];
        if (structures) {
            const spawns = structures.get(STRUCTURE_SPAWN) || [];
            for (let i = 0; i < spawns.length; i++) {
                if (spawns[i].store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                    refillTargets.push(spawns[i]);
                }
            }
            const extensions = structures.get(STRUCTURE_EXTENSION) || [];
            for (let i = 0; i < extensions.length; i++) {
                if (extensions[i].store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                    refillTargets.push(extensions[i]);
                }
            }
        }

        for (const creep of workers) {
            // Determine state based on capacity
            if (creep.store.getUsedCapacity() === 0) {
                creep.heap.state = 'harvest';
            } else if (creep.store.getFreeCapacity() === 0) {
                if (room.energyAvailable < room.energyCapacityAvailable) {
                    creep.heap.state = 'refill';
                } else if (sites && sites.length > 0) {
                    creep.heap.state = 'build';
                } else {
                    creep.heap.state = 'upgrade';
                }
            } else if (!creep.heap.state) {
                // Fallback for global reset
                creep.heap.state = 'harvest';
            }

            // Assign targets based on state
            if (creep.heap.state === 'harvest') {
                if (sources.length > 0) {
                    // O(N) Chebyshev distance for target selection
                    let bestSource = null;
                    let minDistance = Infinity;
                    for (let i = 0; i < sources.length; i++) {
                        const dist = Math.max(Math.abs(creep.pos.x - sources[i].pos.x), Math.abs(creep.pos.y - sources[i].pos.y));
                        if (dist < minDistance) {
                            minDistance = dist;
                            bestSource = sources[i];
                        }
                    }
                    if (bestSource) {
                        creep.heap.targetId = bestSource.id;
                    }
                }
            } else if (creep.heap.state === 'refill') {
                if (refillTargets.length > 0) {
                    creep.heap.targetId = refillTargets[0].id;
                } else {
                    creep.heap.state = 'upgrade'; // fallback
                    if (room.controller) {
                        creep.heap.targetId = room.controller.id;
                    }
                }
            } else if (creep.heap.state === 'build') {
                if (sites && sites.length > 0) {
                    let bestSite = null;
                    let highestPriority = -Infinity;

                    for (let i = 0; i < sites.length; i++) {
                        const site = sites[i];
                        const priority = STRUCTURE_PRIORITIES.get(site.structureType) || STRUCTURE_PRIORITIES.get('default');
                        if (priority > highestPriority) {
                            highestPriority = priority;
                            bestSite = site;
                        }
                    }

                    if (bestSite) {
                        creep.heap.targetId = bestSite.id;
                    } else {
                        creep.heap.targetId = sites[0].id;
                    }
                } else {
                    creep.heap.state = 'upgrade'; // fallback
                    if (room.controller) {
                        creep.heap.targetId = room.controller.id;
                    }
                }
            } else if (creep.heap.state === 'upgrade') {
                if (room.controller) {
                    creep.heap.targetId = room.controller.id;
                }
            }
        }
    }
};
