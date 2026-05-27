const TrafficManager = require('../traffic/trafficManager');
const { isFatigued } = require('../utils/fatigueGating');

module.exports = {
    run(room) {
        const roomCreeps = global.State.creepsByRoom.get(room.name);
        if (!roomCreeps) return;

        const workers = roomCreeps.get('worker');
        if (!workers || workers.length === 0) return;

        let sources = global.State.sourcesByRoom.get(room.name) || [];

        const structures = global.State.structuresByRoom.get(room.name);
        const sitesMap = global.State.sitesByRoom.get(room.name);
        const sites = sitesMap ? (sitesMap instanceof Map ? Array.from(sitesMap.values()) : sitesMap) : [];

        let tasks = [];

        if (structures) {
            const spawnsMap = structures.get(STRUCTURE_SPAWN);
            const spawns = spawnsMap ? Array.from(spawnsMap.values()) : [];
            for (let i = 0; i < spawns.length; i++) {
                const free = TrafficManager.getVirtualState(spawns[i], RESOURCE_ENERGY).free;
                if (free > 0) {
                    tasks.push({ target: spawns[i], type: 'fill', priority: 100, free });
                }
            }
            const extensionsMap = structures.get(STRUCTURE_EXTENSION);
            const extensions = extensionsMap ? Array.from(extensionsMap.values()) : [];
            for (let i = 0; i < extensions.length; i++) {
                const free = TrafficManager.getVirtualState(extensions[i], RESOURCE_ENERGY).free;
                if (free > 0) {
                    tasks.push({ target: extensions[i], type: 'fill', priority: 90, free });
                }
            }
            const rampartsMap = structures.get(STRUCTURE_RAMPART);
            const ramparts = rampartsMap ? Array.from(rampartsMap.values()) : [];
            for (let i = 0; i < ramparts.length; i++) {
                if (ramparts[i].hits < 5000) {
                    tasks.push({ target: ramparts[i], type: 'repair', priority: 70 });
                }
            }
        }

        for (let i = 0; i < sites.length; i++) {
            tasks.push({ target: sites[i], type: 'build', priority: 80 });
        }
        
        if (room.controller) {
            tasks.push({ target: room.controller, type: 'upgrade', priority: 10 });
        }
        
        tasks.sort((a, b) => b.priority - a.priority);
        
        const EnergyRequestManager = require('./EnergyRequestManager');
        const supplies = EnergyRequestManager.getEnergySupplies(room.name, 'worker') || [];
        let supplyTasks = supplies.map(s => ({ target: Game.getObjectById(s.target.id), type: 'pickup', priority: s.priority, amount: s.amount }));
        for (let i = 0; i < sources.length; i++) {
            supplyTasks.push({ target: sources[i], type: 'harvest', priority: 50 });
        }
        supplyTasks.sort((a, b) => b.priority - a.priority);
        
        // Top-Down Assignment: Creeps do not bid or scan for jobs.
        // The manager iterates over creeps and assigns tasks based on O(N) evaluation.
        const sourceAssignments = new Map();

        // Pre-count active tasks to hydrate the assignment tracking
        for (let i = 0; i < workers.length; i++) {
            const creep = workers[i];

            if (isFatigued(creep)) continue;

            // 1. Evaluate State Transition
            if (creep.store.getUsedCapacity() === 0) {
                creep.heap.state = 'get_energy';
                creep.heap.subState = null;
                creep.heap.targetId = null;
            } else if (creep.store.getFreeCapacity() === 0) {
                creep.heap.state = 'work';
                creep.heap.subState = null;
                creep.heap.targetId = null;
            }

            // Only assign if idle or task is finished
            if (creep.heap.subState && creep.heap.targetId) continue;

            // 2. Assign Targets Based on State
            if (creep.heap.state === 'get_energy') {
                if (room.controller && room.controller.level < 3) {
                    // RCL 1-2 Logic: Find dropped energy or harvest directly
                    let targetDropped = null;
                    if (global.State.droppedByRoom) {
                        const roomDropped = global.State.droppedByRoom.get(room.name) || [];
                        targetDropped = roomDropped.find(r => r.resourceType === RESOURCE_ENERGY && r.amount > 50);
                    }
                    if (targetDropped) {
                        creep.heap.targetId = targetDropped.id;
                        creep.heap.subState = 'pickup';
                    } else {
                        const source = sources.length > 0 ? sources[0] : null;
                        creep.heap.targetId = source ? source.id : null;
                        creep.heap.subState = 'harvest';
                    }
                } else {
                    // RCL 3+ Logic: Use VirtualLedger and Storage
                    // Find highest priority valid supply task
                    for (let j = 0; j < supplyTasks.length; j++) {
                        const task = supplyTasks[j];
                        if (task && task.target) {
                            if (task.type === 'pickup' || task.type === 'withdraw') {
                                const VirtualLedger = require('../utils/VirtualLedger');
                                const maxWanted = creep.store.getFreeCapacity(RESOURCE_ENERGY);
                                const claimed = VirtualLedger.claim(creep, task.target, RESOURCE_ENERGY, maxWanted);
                                if (claimed < 0) continue;
                                creep.heap.amount = claimed;
                            }
                            if (task.type === 'harvest') {
                                const assignedCount = sourceAssignments.get(task.target.id) || 0;
                                if (assignedCount >= 3) continue;
                                sourceAssignments.set(task.target.id, assignedCount + 1);
                            }
                            creep.heap.subState = task.type;
                            creep.heap.targetId = task.target.id;
                            if (task.type === 'harvest') {
                                creep.heap.activeTask = 'harvest';
                            }
                            break;
                        }
                    }
                }

                        } else if (creep.heap.state === 'work') {
                if (room.controller && room.controller.level < 3) {
                    const buildSites = sites;

                    let targetFill = null;

                    // Top-Down Extension Logistics override: if energy deficit, find the pre-computed fill task
                    if (room.energyAvailable < room.energyCapacityAvailable) {
                        for (let j = 0; j < tasks.length; j++) {
                            if (tasks[j].type === 'fill') {
                                targetFill = tasks[j].target;
                                break;
                            }
                        }
                    }

                    if (targetFill) {
                        creep.heap.targetId = targetFill.id;
                        creep.heap.subState = 'fill';
                    } else if (buildSites.length > 0) {
                        creep.heap.targetId = buildSites[0].id;
                        creep.heap.subState = 'build';
                    } else if (room.controller) {
                        creep.heap.targetId = room.controller.id;
                        creep.heap.subState = 'upgrade';
                    }
                } else {
                    // Find highest priority valid task
                    for (let j = 0; j < tasks.length; j++) {
                        const task = tasks[j];
                        if (task && task.target) {
                            if (task.type === 'fill' || task.type === 'repair' || task.type === 'build' || task.type === 'upgrade') {
                                const VirtualLedger = require('../utils/VirtualLedger');
                                // Refill tasks should pull amount from the free space, and we'll use creep.heap.amount
                                // We aren't strictly claiming positive space on target, but the ledger is about reserving space
                                // For simplicity to meet the strict bounds, if task.free is defined (like for spawns/extensions), set amount
                                if (task.type === 'fill' && task.free !== undefined) {
                                    const claimAmount = Math.min(creep.store.getUsedCapacity(RESOURCE_ENERGY), task.free);
                                    VirtualLedger.registerIntent(task.target.id, RESOURCE_ENERGY, claimAmount);
                                    creep.heap.amount = claimAmount;
                                }
                            }
                            creep.heap.subState = task.type;
                            creep.heap.targetId = task.target.id;
                            // For non-repeatable tasks, we could splice it out here.
                            break;
                        }
                    }
                }
            }
        }
    }
};
