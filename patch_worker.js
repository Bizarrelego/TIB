const fs = require('fs');

let workerManagerCode = fs.readFileSync('src/managers/workerManager.js', 'utf8');

// The file has:
/*
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
                    creep.heap.state = room.memory.haltUpgrades ? 'refill' : 'upgrade'; // use refill as idle state if upgrades halted
                }
            } else if (!creep.heap.state) {
                // Fallback for global reset
                creep.heap.state = 'harvest';
            }
*/

const search1 = `        for (const creep of workers) {
            // Determine state based on capacity
            if (creep.store.getUsedCapacity() === 0) {
                creep.heap.state = 'harvest';
            } else if (creep.store.getFreeCapacity() === 0) {
                if (room.energyAvailable < room.energyCapacityAvailable) {
                    creep.heap.state = 'refill';
                } else if (sites && sites.length > 0) {
                    creep.heap.state = 'build';
                } else {
                    creep.heap.state = room.memory.haltUpgrades ? 'refill' : 'upgrade'; // use refill as idle state if upgrades halted
                }
            } else if (!creep.heap.state) {
                // Fallback for global reset
                creep.heap.state = 'harvest';
            }`;

const replace1 = `        const roomCreepsAll = global.State.creepsByRoom.get(room.name);
        let harvesterCount = 0;
        let haulerCount = 0;
        if (roomCreepsAll) {
            const harvesters = roomCreepsAll.get('harvester');
            if (harvesters) harvesterCount = harvesters.length;
            const haulers = roomCreepsAll.get('hauler');
            if (haulers) haulerCount = haulers.length;
        }
        const isBootstrapping = harvesterCount === 0 && haulerCount === 0;

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
            }`;

workerManagerCode = workerManagerCode.replace(search1, replace1);

const search2 = `            // Assign targets based on state
            if (creep.heap.state === 'harvest') {`;

const replace2 = `            // Assign targets based on state
            if (creep.heap.state === 'pickup') {
                const EnergyRequestManager = require('./EnergyRequestManager');
                const supplies = EnergyRequestManager.getEnergySupplies(room.name);
                if (supplies.length > 0) {
                    creep.heap.targetId = supplies[0].target.id;
                } else {
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
            } else if (creep.heap.state === 'harvest') {`;

workerManagerCode = workerManagerCode.replace(search2, replace2);

fs.writeFileSync('src/managers/workerManager.js', workerManagerCode);
console.log('workerManager updated');

// Update worker.js
let workerCode = fs.readFileSync('src/roles/worker.js', 'utf8');

const search3 = `                if (state === 'harvest') {
                    if (creep.harvest(target) === ERR_NOT_IN_RANGE) {
                        movement.moveTo(creep, target);
                    }
                } else if (state === 'refill') {`;

const replace3 = `                if (state === 'harvest') {
                    if (creep.harvest(target) === ERR_NOT_IN_RANGE) {
                        movement.moveTo(creep, target);
                    }
                } else if (state === 'pickup') {
                    let res = OK;
                    if (target instanceof Resource) {
                        res = creep.pickup(target);
                    } else {
                        res = creep.withdraw(target, RESOURCE_ENERGY);
                    }
                    if (res === ERR_NOT_IN_RANGE) {
                        movement.moveTo(creep, target);
                    }
                } else if (state === 'repair') {
                    if (creep.repair(target) === ERR_NOT_IN_RANGE) {
                        movement.moveTo(creep, target);
                    }
                } else if (state === 'refill') {`;

workerCode = workerCode.replace(search3, replace3);
fs.writeFileSync('src/roles/worker.js', workerCode);
console.log('worker updated');
