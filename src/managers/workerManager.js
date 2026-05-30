const TrafficManager = require('../traffic/trafficManager');
const { isFatigued } = require('../utils/fatigueGating');
const { isSleeping } = require('../utils/sourceSleep');

module.exports = {
    run(room) {
        const roomCreeps = global.State.creepsByRoom.get(room.name);
        if (!roomCreeps) return;

        const workers = roomCreeps.get('worker');
        if (!workers || workers.length === 0) return;

        let sources = global.State.sourcesByRoom.get(room.name) || [];

        const structures = global.State.structuresByRoom.get(room.name);
        const sitesMap = global.State.sitesByRoom.get(room.name);
        let tasks = [];

        if (structures) {
            const spawnsMap = structures.get(STRUCTURE_SPAWN);
            if (spawnsMap) {
                for (const spawn of spawnsMap.values()) {
                    const free = TrafficManager.getVirtualState(spawn, RESOURCE_ENERGY).free;
                    if (free > 0) {
                        tasks.push({ target: spawn, type: 'fill', priority: 100, free });
                    }
                }
            }
            const extensionsMap = structures.get(STRUCTURE_EXTENSION);
            if (extensionsMap) {
                for (const extension of extensionsMap.values()) {
                    const free = TrafficManager.getVirtualState(extension, RESOURCE_ENERGY).free;
                    if (free > 0) {
                        tasks.push({ target: extension, type: 'fill', priority: 90, free });
                    }
                }
            }
            const rampartsMap = structures.get(STRUCTURE_RAMPART);
            if (rampartsMap) {
                for (const rampart of rampartsMap.values()) {
                    if (rampart.hits < 5000) {
                        tasks.push({ target: rampart, type: 'repair', priority: 70 });
                    }
                }
            }
        }

        if (sitesMap) {
            const sitesIter = sitesMap instanceof Map ? sitesMap.values() : sitesMap;
            for (const site of sitesIter) {
                tasks.push({ target: site, type: 'build', priority: 80 });
            }
        }
        
        if (room.controller) {
            tasks.push({ target: room.controller, type: 'upgrade', priority: 10 });
        }
        
        tasks.sort((a, b) => b.priority - a.priority);
        
        const EnergyRequestManager = require('./EnergyRequestManager');
        const supplies = EnergyRequestManager.getEnergySupplies(room.name, 'worker') || [];
        let supplyTasks = [];
        for (let i = 0; i < supplies.length; i++) {
            const targetObj = Game.getObjectById(supplies[i].target.id);
            if (targetObj) {
                const type = (targetObj instanceof Resource) ? 'pickup' : 'withdraw';
                supplyTasks.push({ target: targetObj, type: type, priority: supplies[i].priority || 0, amount: supplies[i].amount });
            }
        }
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
                creep.heap.activeTask = null;
                creep.heap.amount = undefined;
            } else if (creep.store.getFreeCapacity() === 0 || (creep.store.getUsedCapacity() > 0 && !creep.heap.targetId)) {
                creep.heap.state = 'work';
                creep.heap.subState = null;
                creep.heap.targetId = null;
                creep.heap.activeTask = null;
                creep.heap.amount = undefined;
            }

            // Only assign if idle or task is finished
            if (creep.heap.subState && creep.heap.targetId) continue;

            // 2. Assign Targets Based on State
            if (creep.heap.state === 'get_energy') {
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
            } else if (creep.heap.state === 'work') {
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
};
