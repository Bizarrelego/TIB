const STRUCTURE_PRIORITIES = require('../constants/structurePriorities');
const TrafficManager = require('../traffic/trafficManager');

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
        const refillLedger = new Map();
        if (structures) {
            const spawns = structures.get(STRUCTURE_SPAWN) || [];
            for (let i = 0; i < spawns.length; i++) {
                const free = TrafficManager.getVirtualState(spawns[i], RESOURCE_ENERGY).free;
                if (free > 0) {
                    refillTargets.push(spawns[i]);
                    refillLedger.set(spawns[i].id, free);
                }
            }
            const extensions = structures.get(STRUCTURE_EXTENSION) || [];
            for (let i = 0; i < extensions.length; i++) {
                const free = TrafficManager.getVirtualState(extensions[i], RESOURCE_ENERGY).free;
                if (free > 0) {
                    refillTargets.push(extensions[i]);
                    refillLedger.set(extensions[i].id, free);
                }
            }
        }

        const roomCreepsAll = global.State.creepsByRoom.get(room.name);
        let harvesterCount = 0;
        let haulerCount = 0;
        if (roomCreepsAll) {
            const harvesters = roomCreepsAll.get('harvester');
            if (harvesters) harvesterCount = harvesters.length;
            const haulers = roomCreepsAll.get('hauler');
            if (haulers) haulerCount += haulers.length;
            const domesticHaulers = roomCreepsAll.get('domesticHauler');
            if (domesticHaulers) haulerCount += domesticHaulers.length;
        }
        const isBootstrapping = harvesterCount === 0 && haulerCount === 0;

        // Cache supplies and their virtual capacities for assignment
        const EnergyRequestManager = require('./EnergyRequestManager');
        const supplies = EnergyRequestManager.getEnergySupplies(room.name, 'worker');
        const supplyLedger = new Map();
        for (let i = 0; i < supplies.length; i++) {
            supplyLedger.set(supplies[i].target.id, supplies[i].amount);
        }

        for (const creep of workers) {
            // Determine state based on capacity
            if (creep.store.getUsedCapacity() === 0) {
                creep.heap.state = isBootstrapping ? 'harvest' : 'pickup';
            } else if (creep.store.getFreeCapacity() === 0) {
                if (room.energyAvailable < room.energyCapacityAvailable) {
                    creep.heap.state = 'refill';
                } else if (sites && sites.length > 0) {
                    creep.heap.state = 'build';
                } else {
                    creep.heap.state = 'repair';
                }
            } else if (!creep.heap.state) {
                // Fallback for global reset
                creep.heap.state = isBootstrapping ? 'harvest' : 'pickup';
            }

            // Assign targets based on state
            if (creep.heap.state === 'pickup') {
                let targetAssigned = false;
                for (let i = 0; i < supplies.length; i++) {
                    const supply = supplies[i];
                    const available = supplyLedger.get(supply.target.id) || 0;
                    if (available > 0) {
                        creep.heap.targetId = supply.target.id;
                        supplyLedger.set(supply.target.id, available - creep.store.getFreeCapacity());
                        targetAssigned = true;
                        break;
                    }
                }
                if (!targetAssigned) {
                    creep.heap.targetId = null;
                }
            } else if (creep.heap.state === 'repair') {
                const ramparts = structures ? (structures.get(STRUCTURE_RAMPART) || []) : [];
                let target = null;
                for (let i = 0; i < ramparts.length; i++) {
                    if (ramparts[i].hits < 5000) {
                        target = ramparts[i];
                        break;
                    }
                }
                if (target) {
                    creep.heap.targetId = target.id;
                } else {
                    creep.heap.state = room.memory.haltUpgrades ? 'idle' : 'upgrade'; // fallback to upgrade if nothing to repair
                    if (creep.heap.state === 'upgrade' && room.controller) {
                        creep.heap.targetId = room.controller.id;
                    } else {
                        creep.heap.targetId = null;
                    }
                }
            } else if (creep.heap.state === 'harvest') {
                if (sources.length > 0) {
                    // O(N) Chebyshev distance for target selection
                    let bestSource = null;
                    let minDistance = Infinity;
                    for (let i = 0; i < sources.length; i++) {
                        if (sources[i].energy === 0) continue;
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
            let assigned = false;
            for (let i = 0; i < refillTargets.length; i++) {
                const target = refillTargets[i];
                const virtualFree = refillLedger.get(target.id) || 0;
                if (virtualFree > 0) {
                    creep.heap.targetId = target.id;
                    refillLedger.set(target.id, virtualFree - creep.store.getUsedCapacity(RESOURCE_ENERGY));
                    assigned = true;
                    break;
                }
            }
            if (!assigned) {
                creep.heap.state = room.memory.haltUpgrades ? 'idle' : 'upgrade'; // fallback
                if (creep.heap.state === 'upgrade' && room.controller) {
                    creep.heap.targetId = room.controller.id;
                } else {
                    creep.heap.targetId = null;
                }
            }
            } else if (creep.heap.state === 'build') {
                if (sites && sites.length > 0) {
                    let highestPriority = -Infinity;

                    // Priority Order: STRUCTURE_EXTENSION > STRUCTURE_CONTAINER > STRUCTURE_TOWER > STRUCTURE_STORAGE > STRUCTURE_RAMPART > STRUCTURE_ROAD
                    const customPriorities = new Map([
                        [STRUCTURE_EXTENSION, 100],
                        [STRUCTURE_CONTAINER, 90],
                        [STRUCTURE_TOWER, 80],
                        [STRUCTURE_STORAGE, 70],
                        [STRUCTURE_RAMPART, 60],
                        [STRUCTURE_ROAD, 50]
                    ]);

                    for (let i = 0; i < sites.length; i++) {
                        const site = sites[i];
                        const priority = customPriorities.get(site.structureType) || STRUCTURE_PRIORITIES.get(site.structureType) || STRUCTURE_PRIORITIES.get('default');
                        if (priority > highestPriority) {
                            highestPriority = priority;
                        }
                    }

                    let highestPrioritySites = [];
                    for (let i = 0; i < sites.length; i++) {
                        const site = sites[i];
                        const priority = customPriorities.get(site.structureType) || STRUCTURE_PRIORITIES.get(site.structureType) || STRUCTURE_PRIORITIES.get('default');
                        if (priority === highestPriority) {
                            highestPrioritySites.push(site);
                        }
                    }

                    let bestSite = null;
                    let minDistance = Infinity;

                    // Calculate closest highest priority site to a central point (spawns[0] or controller) to group workers
                    let referencePos = room.controller ? room.controller.pos : creep.pos;
                    if (structures && structures.get(STRUCTURE_SPAWN) && structures.get(STRUCTURE_SPAWN).length > 0) {
                        referencePos = structures.get(STRUCTURE_SPAWN)[0].pos;
                    }

                    for (let i = 0; i < highestPrioritySites.length; i++) {
                        const site = highestPrioritySites[i];
                        const dist = Math.max(Math.abs(referencePos.x - site.pos.x), Math.abs(referencePos.y - site.pos.y));
                        if (dist < minDistance) {
                            minDistance = dist;
                            bestSite = site;
                        }
                    }

                    if (bestSite) {
                        creep.heap.targetId = bestSite.id;
                    } else {
                        creep.heap.targetId = sites[0].id;
                    }
                } else {
                    creep.heap.state = room.memory.haltUpgrades ? 'idle' : 'upgrade'; // fallback
                    if (creep.heap.state === 'upgrade' && room.controller) {
                        creep.heap.targetId = room.controller.id;
                    } else {
                        creep.heap.targetId = null;
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
