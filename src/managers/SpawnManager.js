const planner = require('../colonies/planner');
const BodyCalc = require('../utils/bodyCalc');
const SpawnQueueManager = require('./SpawnQueueManager');
const UpgraderManager = require('./UpgraderManager');

module.exports = {
    /**
     * Runs the spawn manager.
     * @param {Room} room The room to run the spawn manager in.
     * @param {Object} spawnLedger The spawn ledger to use.
     */
    run: function(room, spawnLedger) {
        try {
            // Retrieve spawn via O(1) lookup
            const spawns = global.State.spawnsByRoom.get(room.name);
            if (!spawns || spawns.length === 0) {
                return;
            }

            const availableSpawns = spawns.filter(s => !spawnLedger.isSpawnBusy(s));
            if (availableSpawns.length === 0) {
                return;
            }

            // Check creeps count in this room via O(1) lookup
            const roomCreeps = global.State.creepsByRoom.get(room.name);

            const capacity = room.energyCapacityAvailable;

            // Early Game Spawning (Always maintained regardless of RCL)
            let harvesterCount = 0;
            let workerCount = 0;
            let haulerCount = 0;

            if (roomCreeps) {
                const harvesters = roomCreeps.get('harvester');
                if (harvesters) {
                    harvesterCount = harvesters.length;
                }
                const workers = roomCreeps.get('worker');
                if (workers) {
                    workerCount = workers.length;
                }
                const haulers = roomCreeps.get('hauler');
                if (haulers) {
                    haulerCount = haulers.length;
                }
            }

            // Handle death spirals (no harvesters, low energy)
            const sources = global.State.sourcesByRoom.get(room.name);
            const sourceCount = sources ? sources.length : 1;

            if (harvesterCount === 0 && spawnLedger.getAvailableEnergy() < 300 && room.energyCapacityAvailable >= 300) {
                // If we have less than 300 energy and no harvesters, we might be in a death spiral.
                // Spawn an emergency builder (a small worker) to harvest energy directly to spawn.
                const body = [WORK, CARRY, MOVE];
                const cost = 200;
                if (spawnLedger.canSpawn(cost)) {
                    SpawnQueueManager.requestSpawn(room.name, 'emergencyBuilder', body, 'emergency_' + Game.time, { memory: { role: 'worker', colony: room.name } }, cost);
                }
            }

            // Spawn harvesters first
            if (harvesterCount < sourceCount) {
                const energyAvailable = spawnLedger.getAvailableEnergy();
                const calcCapacity = (harvesterCount === 0 && energyAvailable < capacity && energyAvailable >= 250) ? energyAvailable : capacity;
                const body = BodyCalc.calculateEarlyGameHarvester(calcCapacity);
                const cost = BodyCalc.getCost(body);
                SpawnQueueManager.requestSpawn(room.name, 'harvester', body, 'harvester_' + Game.time, { memory: { role: 'harvester', colony: room.name } }, cost);
            }

            // Spawn a domestic hauler to move energy from harvesters to spawn/extensions
            if (haulerCount < 2) {
                const body = BodyCalc.calculateDomesticHauler(capacity);
                const cost = BodyCalc.getCost(body);
                SpawnQueueManager.requestSpawn(room.name, 'domesticHauler', body, 'domesticHauler_' + Game.time, { memory: { role: 'domesticHauler', colony: room.name } }, cost);
            }

            // Spawn a worker to act as multi-purpose builder/upgrader
            if (workerCount < 2) {
                const body = BodyCalc.calculateWorker(capacity);
                const cost = BodyCalc.getCost(body);
                SpawnQueueManager.requestSpawn(room.name, 'worker', body, 'worker_' + Game.time, { memory: { role: 'worker', colony: room.name } }, cost);
            }

            // Global Scout Spawning Logic (1 active scout globally)
            if (room.controller.level >= 2) {
            let totalScouts = 0;
            for (const crps of global.State.creepsByRoom.values()) {
                const s = crps.get('scout');
                if (s) totalScouts += s.length;
            }

            if (totalScouts < 1) {
                if (spawnLedger.canSpawn(50)) {
                    SpawnQueueManager.requestSpawn(room.name, 'scout', [MOVE], 'scout_' + Game.time, {
                    memory: { role: 'scout', colony: room.name }
                }, 50);
                }
            }
        }

        // RCL 5 Logic: hubManager & upgrader
        if (room.controller.level >= 5) {
            if (spawnLedger.isLinkNetworkPresent(room)) {
                let hubManagerCount = 0;
                let upgraderCount = 0;
                if (roomCreeps) {
                    const hubManagers = roomCreeps.get('hubManager');
                    if (hubManagers) {
                        hubManagerCount = hubManagers.length;
                    }

                    const upgraders = roomCreeps.get('upgrader');
                    if (upgraders) {
                        upgraderCount = upgraders.length;
                    }
                }

                if (hubManagerCount < 1) {
                    // Optimized body for hub transfer: 800 capacity
                    const body = [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE];
                    const cost = (16 * BODYPART_COST[CARRY]) + BODYPART_COST[MOVE]; // 16 * 50 + 50 = 850
                    if (spawnLedger.canSpawn(cost)) {
                    SpawnQueueManager.requestSpawn(room.name, 'hubManager', body, 'hubManager_' + Game.time, {
                        memory: { role: 'hubManager', colony: room.name }
                    }, cost);
                }
                }

                const desiredUpgraders = UpgraderManager.getDesiredCount(room);
                if (upgraderCount < desiredUpgraders) {
                    const body = BodyCalc.calculateUpgrader(capacity);
                    const cost = BodyCalc.getCost(body);
                    if (spawnLedger.canSpawn(cost)) {
                    SpawnQueueManager.requestSpawn(room.name, 'upgrader', body, 'upgrader_' + Game.time, {
                        memory: { role: 'upgrader', colony: room.name }
                    }, cost);
                }
                }
            }
        }

        // RCL 4 Logic: fastFiller
        if (room.controller.level >= 4) {
            let storageExists = false;
            let storageCloseToCompletion = false;

            const structures = global.State.structuresByRoom.get(room.name);
            if (structures) {
                const storages = structures.get(STRUCTURE_STORAGE) || [];
                if (storages.length > 0) {
                    storageExists = true;
                }
            }

            if (!storageExists) {
                const sites = global.State.sitesByRoom.get(room.name);
                if (sites) {
                    for (let i = 0; i < sites.length; i++) {
                        if (sites[i].structureType === STRUCTURE_STORAGE) {
                            const buildPower = planner.getBuildPower(room.name);
                            if (sites[i].progress >= sites[i].progressTotal - buildPower) {
                                storageCloseToCompletion = true;
                            }
                            break;
                        }
                    }
                }
            }

            if (storageExists || storageCloseToCompletion) {
                let fastFillerCount = 0;
                if (roomCreeps) {
                    const fastFillers = roomCreeps.get('fastFiller');
                    if (fastFillers) {
                        fastFillerCount = fastFillers.length;
                    }
                }

                if (fastFillerCount < 2) { // Target amount of fastFillers
                    // Calculate 1:1 CARRY:MOVE body up to room.energyCapacityAvailable
                    let body = [];
                    let cost = 0;
                    const pairCost = BODYPART_COST[CARRY] + BODYPART_COST[MOVE];
                    while (cost + pairCost <= capacity && body.length < 50) {
                        body.push(CARRY, MOVE);
                        cost += pairCost;
                    }

                    if (body.length > 0) {
                        if (spawnLedger.canSpawn(cost)) {
                            SpawnQueueManager.requestSpawn(room.name, 'fastFiller', body, 'fastFiller_' + Game.time, {
                                memory: { role: 'fastFiller', colony: room.name }
                            }, cost);
                        }
                    }
                }
            }
        }

        // Remote Economy Spawning Logic (RCL >= 3)
        if (room.controller.level >= 3 && global.State.intel) {
            const exits = Game.map.describeExits(room.name);
            if (exits) {
                let colonyRemoteHarvesters = [];
                let colonyRemoteHaulers = [];
                let colonyReservers = [];

                for (const rmCreeps of global.State.creepsByRoom.values()) {
                    const rHarvesters = rmCreeps.get('remoteHarvester') || [];
                    for (let i = 0; i < rHarvesters.length; i++) {
                        if (rHarvesters[i].memory.colony === room.name) colonyRemoteHarvesters.push(rHarvesters[i]);
                    }

                    const rHaulers = rmCreeps.get('remoteHauler') || [];
                    for (let i = 0; i < rHaulers.length; i++) {
                        if (rHaulers[i].memory.colony === room.name) colonyRemoteHaulers.push(rHaulers[i]);
                    }

                    const rReservers = rmCreeps.get('reserver') || [];
                    for (let i = 0; i < rReservers.length; i++) {
                        if (rReservers[i].memory.colony === room.name) colonyReservers.push(rReservers[i]);
                    }
                }

                for (const direction in exits) {
                    const targetRoomName = exits[direction];
                    const intel = global.State.intel.get(targetRoomName);

                    if (intel && intel.type === 'regular' && !intel.hostile) {
                        const activeReserver = colonyReservers.find(c => c.memory.targetRoom === targetRoomName);

                        if (!activeReserver && intel.reservation !== 'jules') {
                            const body = capacity >= 1300 ? [CLAIM, CLAIM, MOVE, MOVE] : [CLAIM, MOVE];
                            const cost = capacity >= 1300 ? 1300 : 650;
                            if (capacity >= cost && spawnLedger.canSpawn(cost)) {
                                SpawnQueueManager.requestSpawn(room.name, 'reserver', body, 'reserver_' + Game.time, {
                                    memory: { role: 'reserver', colony: room.name, targetRoom: targetRoomName }
                                }, cost);
                            }
                        }

                        const sourcesCount = intel.sources || 0;
                        if (sourcesCount > 0 && (intel.reservation === 'jules' || activeReserver)) {
                            const roomRemoteHarvesters = colonyRemoteHarvesters.filter(c => c.memory.targetRoom === targetRoomName);

                            if (roomRemoteHarvesters.length < sourcesCount) {
                                const body = [WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE];
                                const cost = 700;
                                if (capacity >= cost && spawnLedger.canSpawn(cost)) {
                                    SpawnQueueManager.requestSpawn(room.name, 'remoteHarvester', body, 'remoteHarvester_' + Game.time, {
                                        memory: { role: 'remoteHarvester', colony: room.name, targetRoom: targetRoomName, targetSourceId: null }
                                    }, cost);
                                }
                            }

                            const roomRemoteHaulers = colonyRemoteHaulers.filter(c => c.memory.remoteRoom === targetRoomName);

                            if (roomRemoteHaulers.length < roomRemoteHarvesters.length * 2) {
                                const body = [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE];
                                const cost = 450;
                                if (capacity >= cost && spawnLedger.canSpawn(cost)) {
                                    SpawnQueueManager.requestSpawn(room.name, 'remoteHauler', body, 'remoteHauler_' + Game.time, {
                                        memory: { role: 'remoteHauler', colony: room.name, homeRoom: room.name, remoteRoom: targetRoomName, containerId: null }
                                    }, cost);
                                }
                            }
                        }
                    }
                }
            }
        }

            // Process the queue
            const queue = new SpawnQueueManager();
            queue.process(spawns, spawnLedger);

        } catch (e) {
            console.log(`[SpawnManager Error] Room ${room.name}: ${e.stack}`);
        }
    }
};
