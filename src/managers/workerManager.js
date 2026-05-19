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
        let supplyTasks = supplies.map(s => ({ target: Game.getObjectById(s.target.id), type: 'pickup', priority: s.priority }));
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
            if (creep.heap.activeTask === 'harvest' && creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
                creep.heap.activeTask = null;
            }
            if (creep.heap.activeTask === 'harvest' && creep.heap.targetId) {
                const count = sourceAssignments.get(creep.heap.targetId) || 0;
                sourceAssignments.set(creep.heap.targetId, count + 1);
            }
        }

        for (let i = 0; i < workers.length; i++) {
            const creep = workers[i];

            if (creep.heap.activeTask) continue;

            if (isFatigued(creep)) continue;

            if (creep.heap.state === 'harvest' && creep.heap.targetId) {
                const source = Game.getObjectById(creep.heap.targetId);
                if (source && isSleeping(source)) continue;
            }
            
            // Only assign if idle or task is finished
            if (creep.heap.state && creep.heap.targetId) continue;
            
            if (creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                // Find highest priority valid task
                for (let j = 0; j < tasks.length; j++) {
                    const task = tasks[j];
                    if (task && task.target) {
                        creep.heap.state = task.type;
                        creep.heap.targetId = task.target.id;
                        // For non-repeatable tasks, we could splice it out here.
                        break;
                    }
                }
            } else {
                // Find highest priority valid supply task
                for (let j = 0; j < supplyTasks.length; j++) {
                    const task = supplyTasks[j];
                    if (task && task.target) {
                        if (task.type === 'harvest') {
                            const count = sourceAssignments.get(task.target.id) || 0;
                            if (count >= 3) continue;
                            sourceAssignments.set(task.target.id, count + 1);
                        }
                        creep.heap.state = task.type;
                        creep.heap.targetId = task.target.id;
                        if (task.type === 'harvest') {
                            creep.heap.activeTask = 'harvest';
                        }
                        break;
                    }
                }
            }
        }
    }
};
