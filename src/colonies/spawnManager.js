const CreepBodyBuilder = require('./CreepBodyBuilder');
const SpawnQueueManager = require('../managers/SpawnQueueManager');
const Profiler = require('../utils/profiler');
const CreepRoleBalancer = require('./CreepRoleBalancer');

let lastCensusTick = 0;
const remoteCensus = new Map();

/**
 * Executes an empire-wide O(N) sweep exactly once per tick to tally remote creeps by colony.
 * Prevents O(R*C) iteration scaling when multiple rooms request spawns.
 */
function buildRemoteCensus() {
    if (Game.time === lastCensusTick) return;
    remoteCensus.clear();
    // Iterate over live creeps to build census, avoiding stale cache objects.
    for (const name in Game.creeps) {
        const c = Game.creeps[name];
        if (c.memory.colony) {
            if (!remoteCensus.has(c.memory.colony)) {
                remoteCensus.set(c.memory.colony, { remoteHarvester: [], remoteHauler: [], reserver: [] });
            }
            const colonyCensus = remoteCensus.get(c.memory.colony);
            if (c.memory.role === 'remoteHarvester') {
                colonyCensus.remoteHarvester.push(c);
            } else if (c.memory.role === 'remoteHauler') {
                colonyCensus.remoteHauler.push(c);
            } else if (c.memory.role === 'reserver') {
                colonyCensus.reserver.push(c);
            }
        }
    }
    lastCensusTick = Game.time;
}

module.exports = {
    /**
     * Runs the spawn manager.
     * @param {Room} room The room to run the spawn manager in.
     * @param {Object} spawnLedger The spawn ledger to use.
     */
    run: Profiler.wrap('SpawnManager.run', function(room, spawnLedger) {
        try {
            // Empire-wide census check (O(N) executed once per tick globally)
            buildRemoteCensus();

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

            // Emergency Bootstrap Override
            if (workerCount === 0 && harvesterCount === 0) {
                // Bypass all ledger and queue logic. Force an immediate spawn.
                if (spawns.length > 0 && room.energyAvailable >= 200) {
                    const spawn = spawns[0];
                    if (!spawnLedger.isSpawnBusy(spawn)) {
                        spawn.spawnCreep([WORK, CARRY, MOVE], `bootstrap_${Game.time}`, { memory: { role: 'worker', colony: room.name }});
                    }
                    return; // Halt all other spawn logic for this room this tick
                }
            }

            const desiredCounts = CreepRoleBalancer.calculateDesiredRoleCounts(room.name);
            const targetWorkers = desiredCounts.get('worker') || 0;
            const targetHarvesters = desiredCounts.get('harvester') || 0;
            const targetHaulers = desiredCounts.get('domesticHauler') || 0;

            // Spawns the initial bootstrap worker exclusively to start the colony economy
            const queuedWorkers = SpawnQueueManager.getQueuedCount(room.name, 'worker');
            if (workerCount + queuedWorkers < targetWorkers) {
                const energyAvailable = spawnLedger.getAvailableEnergy();
                const calcCapacity = (workerCount === 0 && energyAvailable < capacity && energyAvailable >= 200) ? energyAvailable : capacity;
                const body = CreepBodyBuilder.build('worker', calcCapacity, room.controller.level);
                const cost = CreepBodyBuilder.getCost(body);
                if (spawnLedger.canSpawn(cost)) {
                    SpawnQueueManager.requestSpawn(room.name, 'worker', body, 'worker_' + Game.time, { memory: { role: 'worker', colony: room.name } }, cost);
                }
            }

            // Spawn harvesters first
            const queuedHarvesters = SpawnQueueManager.getQueuedCount(room.name, 'harvester');
            if (harvesterCount + queuedHarvesters < targetHarvesters) {
                const energyAvailable = spawnLedger.getAvailableEnergy();
                const calcCapacity = (haulerCount === 0 && energyAvailable < capacity && energyAvailable >= 200) ? energyAvailable : capacity;
                const body = CreepBodyBuilder.build('harvester', calcCapacity, room.controller.level);
                const cost = CreepBodyBuilder.getCost(body);
                SpawnQueueManager.requestSpawn(room.name, 'harvester', body, 'harvester_' + Game.time, { memory: { role: 'harvester', colony: room.name } }, cost);
            }

            // Spawn a domestic hauler to move energy from harvesters to spawn/extensions
            // Retire domestic haulers at RCL 5 if a Link network is established
            const queuedHaulers = SpawnQueueManager.getQueuedCount(room.name, 'domesticHauler');
            if (haulerCount + queuedHaulers < targetHaulers && (!room.controller || room.controller.level < 5 || !spawnLedger.isLinkNetworkPresent(room))) {
                const energyAvailable = spawnLedger.getAvailableEnergy();
                const calcCapacity = (haulerCount === 0 && energyAvailable < capacity && energyAvailable >= 200) ? energyAvailable : capacity;
                const body = CreepBodyBuilder.build('domesticHauler', calcCapacity, room.controller.level);
                const cost = CreepBodyBuilder.getCost(body);
                SpawnQueueManager.requestSpawn(room.name, 'domesticHauler', body, 'domesticHauler_' + Game.time, { memory: { role: 'domesticHauler', colony: room.name } }, cost);
            }



            // Global Scout Spawning Logic (1 active scout globally)
            if (room.controller.level >= 1) {
            let totalScouts = 0;
            for (const crps of global.State.creepsByRoom.values()) {
                const s = crps.get('scout');
                if (s) totalScouts += s.length;
            }

            if (totalScouts < 1) {
                const queuedScouts = SpawnQueueManager.getQueuedCount(room.name, 'scout');
                if (queuedScouts === 0 && spawnLedger.canSpawn(50)) {
                    SpawnQueueManager.requestSpawn(room.name, 'scout', [MOVE], 'scout_' + Game.time, {
                        memory: { role: 'scout', colony: room.name }
                    }, 50);
                }
            }
        }

        // RCL 5 Logic: hubManager & upgrader
        // Upgrader Spawning
        let upgraderCount = 0;
        if (roomCreeps) {
            const upgraders = roomCreeps.get('upgrader');
            if (upgraders) upgraderCount = upgraders.length;
        }

        const desiredUpgraders = desiredCounts.get('upgrader') || 0;

        const queuedUpgraders = SpawnQueueManager.getQueuedCount(room.name, 'upgrader');
        if (upgraderCount + queuedUpgraders < desiredUpgraders) {
            const body = CreepBodyBuilder.build('upgrader', capacity, room.controller.level);
            const cost = CreepBodyBuilder.getCost(body);
            if (spawnLedger.canSpawn(cost)) {
                SpawnQueueManager.requestSpawn(room.name, 'upgrader', body, 'upgrader_' + Game.time, {
                    memory: { role: 'upgrader', colony: room.name }
                }, cost);
            }
        }

        // RCL 5 Logic: hubManager
        if (room.controller.level >= 5) {
            if (spawnLedger.isLinkNetworkPresent(room)) {
                let hubManagerCount = 0;
                if (roomCreeps) {
                    const hubManagers = roomCreeps.get('hubManager');
                    if (hubManagers) hubManagerCount = hubManagers.length;
                }

                const targetHubManagers = desiredCounts.get('hubManager') || 0;
                const queuedHubManagers = SpawnQueueManager.getQueuedCount(room.name, 'hubManager');
                if (hubManagerCount + queuedHubManagers < targetHubManagers) {
                    const body = CreepBodyBuilder.build('hubManager', capacity, room.controller.level);
                    const cost = CreepBodyBuilder.getCost(body);
                    if (spawnLedger.canSpawn(cost)) {
                        SpawnQueueManager.requestSpawn(room.name, 'hubManager', body, 'hubManager_' + Game.time, {
                            memory: { role: 'hubManager', colony: room.name }
                        }, cost);
                    }
                }
            }
        }

        // Fast Filler Spawning
        let fastFillerCount = 0;
        if (roomCreeps) {
            const fastFillers = roomCreeps.get('fastFiller');
            if (fastFillers) fastFillerCount = fastFillers.length;
        }
        const desiredFastFillers = desiredCounts.get('fastFiller') || 0;

        const queuedFastFillers = SpawnQueueManager.getQueuedCount(room.name, 'fastFiller');
        if (fastFillerCount + queuedFastFillers < desiredFastFillers) {
            const body = CreepBodyBuilder.build('fastFiller', capacity, room.controller.level);
            const cost = CreepBodyBuilder.getCost(body);

            if (body.length > 0 && spawnLedger.canSpawn(cost)) {
                SpawnQueueManager.requestSpawn(room.name, 'fastFiller', body, 'fastFiller_' + Game.time, {
                    memory: { role: 'fastFiller', colony: room.name }
                }, cost);
            }
        }

        // Remote Economy Spawning Logic (RCL >= 3)
        if (room.controller.level >= 3 && global.State.intel) {
            const exits = Game.map.describeExits(room.name);
            if (exits) {
                // O(1) lookup for remote operations scaling
                const census = remoteCensus.get(room.name) || { remoteHarvester: [], remoteHauler: [], reserver: [] };
                let colonyRemoteHarvesters = census.remoteHarvester;
                let colonyReservers = census.reserver;

                for (const direction in exits) {
                    const targetRoomName = exits[direction];
                    const intel = global.State.intel.get(targetRoomName);

                    if (intel && intel.type === 'regular' && !intel.hostile) {
                        const activeReserver = colonyReservers.find(c => c.memory.targetRoom === targetRoomName);

                        if (!activeReserver && intel.reservation !== 'jules') {
                            const body = CreepBodyBuilder.build('reserver', capacity, room.controller.level);
                            const cost = CreepBodyBuilder.getCost(body);
                            // Keep the max capacity requirement of >= 650 or >= 1300 as originally modeled
                            const requiredCapacity = capacity >= 1300 ? 1300 : 650;
                            if (capacity >= requiredCapacity && spawnLedger.canSpawn(cost)) {
                                SpawnQueueManager.requestSpawn(room.name, 'reserver', body, 'reserver_' + Game.time, {
                                    memory: { role: 'reserver', colony: room.name, targetRoom: targetRoomName }
                                }, cost);
                            }
                        }

                        const sourcesCount = intel.sources || 0;
                        if (sourcesCount > 0 && (intel.reservation === 'jules' || activeReserver)) {
                            const roomRemoteHarvesters = colonyRemoteHarvesters.filter(c => c.memory.targetRoom === targetRoomName);

                            if (roomRemoteHarvesters.length < sourcesCount) {
                                const sourceCapacity = (intel.reservation === 'jules' || activeReserver) ? 3000 : 1500;
                                const body = CreepBodyBuilder.build('remoteHarvester', capacity, room.controller.level, { sourceCapacity });
                                const cost = CreepBodyBuilder.getCost(body);
                                if (capacity >= cost && spawnLedger.canSpawn(cost)) {
                                    SpawnQueueManager.requestSpawn(room.name, 'remoteHarvester', body, 'remoteHarvester_' + Game.time, {
                                        memory: { role: 'remoteHarvester', colony: room.name, targetRoom: targetRoomName, targetSourceId: null }
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
    })
};
