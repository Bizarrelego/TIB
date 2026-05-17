const TrafficManager = require('../traffic/trafficManager');

module.exports = {
    run(room) {
        const roomCreeps = global.State.creepsByRoom.get(room.name);
        if (!roomCreeps) return;

        const workers = roomCreeps.get('worker');
        if (!workers || workers.length === 0) return;

        const sources = global.State.sourcesByRoom.get(room.name) || [];
        const structures = global.State.structuresByRoom.get(room.name);
        const sites = global.State.sitesByRoom.get(room.name);

        let tasks = [];

        if (structures) {
            const spawns = structures.get(STRUCTURE_SPAWN) || [];
            for (let i = 0; i < spawns.length; i++) {
                const free = TrafficManager.getVirtualState(spawns[i], RESOURCE_ENERGY).free;
                if (free > 0) {
                    tasks.push({ target: spawns[i], type: 'fill', priority: 100, free });
                }
            }
            const extensions = structures.get(STRUCTURE_EXTENSION) || [];
            for (let i = 0; i < extensions.length; i++) {
                const free = TrafficManager.getVirtualState(extensions[i], RESOURCE_ENERGY).free;
                if (free > 0) {
                    tasks.push({ target: extensions[i], type: 'fill', priority: 90, free });
                }
            }
            const ramparts = structures.get(STRUCTURE_RAMPART) || [];
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
        
        let idleCreeps = workers.filter(c => !c.heap.state || !c.heap.targetId);
        
        for (const task of tasks) {
            if (idleCreeps.length === 0) break;
            
            let nearestCreepIdx = -1;
            let minDistance = Infinity;
            
            for (let i = 0; i < idleCreeps.length; i++) {
                const creep = idleCreeps[i];
                if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) continue;
                
                const dist = Math.max(Math.abs(creep.pos.x - task.target.pos.x), Math.abs(creep.pos.y - task.target.pos.y));
                if (dist < minDistance) {
                    minDistance = dist;
                    nearestCreepIdx = i;
                }
            }
            if (nearestCreepIdx !== -1) {
                const creep = idleCreeps[nearestCreepIdx];
                creep.heap.state = task.type;
                creep.heap.targetId = task.target.id;
                idleCreeps.splice(nearestCreepIdx, 1);
            }
        }
        
        for (const task of supplyTasks) {
            if (!task.target) continue;
            if (idleCreeps.length === 0) break;
            
            let nearestCreepIdx = -1;
            let minDistance = Infinity;
            for (let i = 0; i < idleCreeps.length; i++) {
                const creep = idleCreeps[i];
                if (creep.store.getFreeCapacity() === 0) continue;
                
                const dist = Math.max(Math.abs(creep.pos.x - task.target.pos.x), Math.abs(creep.pos.y - task.target.pos.y));
                if (dist < minDistance) {
                    minDistance = dist;
                    nearestCreepIdx = i;
                }
            }
            if (nearestCreepIdx !== -1) {
                const creep = idleCreeps[nearestCreepIdx];
                creep.heap.state = task.type;
                creep.heap.targetId = task.target.id;
                idleCreeps.splice(nearestCreepIdx, 1);
            }
        }
    }
};
