/**
 * @file EconomyManager.js
 * @description Centralized manager for core economy roles: harvester, hauler, and worker.
 * Executes top-down state and target assignments for creeps without self-evaluation.
 */

const STRUCTURE_PRIORITIES = require('../constants/structurePriorities');

const EconomyManager = {
    /**
     * Executes top-down assignments for core economy roles.
     * @param {Room} room The room to manage.
     */
    run(room) {
        const roomCreeps = global.State.creepsByRoom.get(room.name);
        if (!roomCreeps) return;

        const harvesters = roomCreeps.get('harvester') || [];
        const haulers = roomCreeps.get('hauler') || [];
        const workers = roomCreeps.get('worker') || [];

        // Common State Lookups
        const sources = global.State.sourcesByRoom.get(room.name) || [];
        const structures = global.State.structuresByRoom.get(room.name) || new Map();
        const sites = global.State.sitesByRoom.get(room.name) || [];

        const droppedEnergy = global.State.droppedEnergyByRoom ? global.State.droppedEnergyByRoom.get(room.name) || [] : (global.State.droppedByRoom ? global.State.droppedByRoom.get(room.name) || [] : []);
        const tombstones = global.State.tombstonesByRoom ? global.State.tombstonesByRoom.get(room.name) || [] : [];
        const ruins = global.State.ruinsByRoom ? global.State.ruinsByRoom.get(room.name) || [] : [];

        const spawns = structures.get(STRUCTURE_SPAWN) || [];
        const extensions = structures.get(STRUCTURE_EXTENSION) || [];
        const storages = structures.get(STRUCTURE_STORAGE) || [];
        const storage = storages[0];

        // Ensure creep heaps are initialized
        for (const role of [harvesters, haulers, workers]) {
            for (const creep of role) {
                if (!creep.heap) creep.heap = {};
            }
        }

        // --- HARVESTER ASSIGNMENT ---
        if (harvesters.length > 0 && sources.length > 0) {
            const assignedSources = new Set();
            for (const h of harvesters) {
                if (h.heap.targetId) assignedSources.add(h.heap.targetId);
            }

            for (const creep of harvesters) {
                if (!creep.heap.targetId) {
                    let targetSource = sources.find(s => !assignedSources.has(s.id));
                    if (!targetSource) {
                        let minDistance = Infinity;
                        for (let i = 0; i < sources.length; i++) {
                            const dist = Math.max(Math.abs(creep.pos.x - sources[i].pos.x), Math.abs(creep.pos.y - sources[i].pos.y));
                            if (dist < minDistance) {
                                minDistance = dist;
                                targetSource = sources[i];
                            }
                        }
                    }
                    if (targetSource) {
                        creep.heap.targetId = targetSource.id;
                        assignedSources.add(targetSource.id);
                    }
                }
            }
        }

        // --- HAULER ASSIGNMENT ---
        if (haulers.length > 0) {
            for (const creep of haulers) {
                // State Assignment
                if (creep.store.getFreeCapacity() === 0) {
                    creep.heap.state = 'transfer';
                } else if (creep.store.getUsedCapacity() === 0) {
                    creep.heap.state = 'pickup';
                } else if (!creep.heap.state) {
                    creep.heap.state = 'pickup'; // Fallback
                }

                // Target Assignment
                if (creep.heap.state === 'pickup') {
                    let dropId = creep.heap.dropId;
                    let target = dropId ? Game.getObjectById(dropId) : null;

                    if (!target || (target.amount === 0) || (target.store && target.store.getUsedCapacity(RESOURCE_ENERGY) === 0)) {
                        target = null;
                        let minDistance = Infinity;

                        const checkTarget = (t) => {
                            if (t.amount > 0 || (t.store && t.store.getUsedCapacity(RESOURCE_ENERGY) > 0)) {
                                const dist = Math.max(Math.abs(creep.pos.x - t.pos.x), Math.abs(creep.pos.y - t.pos.y));
                                if (dist < minDistance) {
                                    minDistance = dist;
                                    target = t;
                                }
                            }
                        };

                        for (let j = 0; j < droppedEnergy.length; j++) checkTarget(droppedEnergy[j]);
                        for (let j = 0; j < tombstones.length; j++) checkTarget(tombstones[j]);
                        for (let j = 0; j < ruins.length; j++) checkTarget(ruins[j]);

                        creep.heap.dropId = target ? target.id : null;
                    }
                } else if (creep.heap.state === 'transfer') {
                    creep.heap.dropId = null;
                    let target = null;

                    for (let j = 0; j < spawns.length; j++) {
                        if (spawns[j].store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                            target = spawns[j];
                            break;
                        }
                    }
                    if (!target) {
                        for (let j = 0; j < extensions.length; j++) {
                            if (extensions[j].store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                                target = extensions[j];
                                break;
                            }
                        }
                    }
                    if (!target && storage && storage.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                        target = storage;
                    }

                    if (target) {
                        creep.heap.targetId = target.id;
                    } else if (room.controller) {
                        creep.heap.targetId = 'controller';
                    } else {
                        creep.heap.targetId = null;
                    }
                }
            }
        }

        // --- WORKER ASSIGNMENT ---
        if (workers.length > 0) {
            let refillTargets = [];
            for (let i = 0; i < spawns.length; i++) {
                if (spawns[i].store.getFreeCapacity(RESOURCE_ENERGY) > 0) refillTargets.push(spawns[i]);
            }
            for (let i = 0; i < extensions.length; i++) {
                if (extensions[i].store.getFreeCapacity(RESOURCE_ENERGY) > 0) refillTargets.push(extensions[i]);
            }

            for (const creep of workers) {
                // Determine state based on capacity
                if (creep.store.getUsedCapacity() === 0) {
                    // Try to pick up dropped energy first, otherwise harvest
                    if (droppedEnergy.length > 0 || ruins.length > 0 || tombstones.length > 0) {
                        creep.heap.state = 'pickup';
                    } else {
                        creep.heap.state = 'harvest';
                    }
                } else if (creep.store.getFreeCapacity() === 0) {
                    if (room.energyAvailable < room.energyCapacityAvailable) {
                        creep.heap.state = 'refill';
                    } else if (sites && sites.length > 0) {
                        creep.heap.state = 'build';
                    } else {
                        creep.heap.state = 'upgrade';
                    }
                } else if (!creep.heap.state) {
                    creep.heap.state = 'harvest'; // Fallback
                }

                // Assign targets based on state
                if (creep.heap.state === 'harvest') {
                    if (sources.length > 0) {
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
                } else if (creep.heap.state === 'pickup') {
                    let target = null;
                    let minDistance = Infinity;

                    const checkTarget = (t) => {
                        if (t.amount > 0 || (t.store && t.store.getUsedCapacity(RESOURCE_ENERGY) > 0)) {
                            const dist = Math.max(Math.abs(creep.pos.x - t.pos.x), Math.abs(creep.pos.y - t.pos.y));
                            if (dist < minDistance) {
                                minDistance = dist;
                                target = t;
                            }
                        }
                    };

                    for (let j = 0; j < droppedEnergy.length; j++) checkTarget(droppedEnergy[j]);
                    for (let j = 0; j < tombstones.length; j++) checkTarget(tombstones[j]);
                    for (let j = 0; j < ruins.length; j++) checkTarget(ruins[j]);

                    if (target) {
                        creep.heap.targetId = target.id;
                    } else {
                        creep.heap.state = 'harvest'; // Fallback to harvest if no pickup targets found
                    }
                } else if (creep.heap.state === 'refill') {
                    if (refillTargets.length > 0) {
                        creep.heap.targetId = refillTargets[0].id;
                    } else {
                        creep.heap.state = 'upgrade'; // fallback
                        if (room.controller) creep.heap.targetId = room.controller.id;
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

                        creep.heap.targetId = bestSite ? bestSite.id : sites[0].id;
                    } else {
                        creep.heap.state = 'upgrade'; // fallback
                        if (room.controller) creep.heap.targetId = room.controller.id;
                    }
                } else if (creep.heap.state === 'upgrade') {
                    if (room.controller) {
                        creep.heap.targetId = room.controller.id;
                    }
                }
            }
        }
    }
};

module.exports = EconomyManager;
