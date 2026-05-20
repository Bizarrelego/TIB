const BodyCalc = require('../utils/bodyCalc');
const SpawnQueueManager = require('../managers/SpawnQueueManager');
const UpgraderManager = require('../managers/UpgraderManager');
const Profiler = require('../utils/profiler');
const BootstrapPlanner = require('./BootstrapPlanner');

let lastCensusTick = 0;
const remoteCensus = new Map();

/**
 * Executes an empire-wide O(N) sweep exactly once per tick to tally remote creeps by colony.
 * Prevents O(R*C) iteration scaling when multiple rooms request spawns.
 */
function buildRemoteCensus() {
    if (Game.time === lastCensusTick) return;
    remoteCensus.clear();
    for (const rmCreeps of global.State.creepsByRoom.values()) {
        const rHarvesters = rmCreeps.get('remoteHarvester') || [];
        for (let i = 0; i < rHarvesters.length; i++) {
            const c = rHarvesters[i];
            if (c.memory.colony) {
                if (!remoteCensus.has(c.memory.colony)) remoteCensus.set(c.memory.colony, { remoteHarvester: [], remoteHauler: [], reserver: [] });
                remoteCensus.get(c.memory.colony).remoteHarvester.push(c);
            }
        }
        const rHaulers = rmCreeps.get('remoteHauler') || [];
        for (let i = 0; i < rHaulers.length; i++) {
            const c = rHaulers[i];
            if (c.memory.colony) {
                if (!remoteCensus.has(c.memory.colony)) remoteCensus.set(c.memory.colony, { remoteHarvester: [], remoteHauler: [], reserver: [] });
                remoteCensus.get(c.memory.colony).remoteHauler.push(c);
            }
        }
        const rReservers = rmCreeps.get('reserver') || [];
        for (let i = 0; i < rReservers.length; i++) {
            const c = rReservers[i];
            if (c.memory.colony) {
                if (!remoteCensus.has(c.memory.colony)) remoteCensus.set(c.memory.colony, { remoteHarvester: [], remoteHauler: [], reserver: [] });
                remoteCensus.get(c.memory.colony).reserver.push(c);
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

            const bootstrapReqs = BootstrapPlanner.getCreepRequirements(room);

            // Spawns the initial bootstrap worker exclusively to start the colony economy
            if (workerCount < bootstrapReqs.worker) {
                const energyAvailable = spawnLedger.getAvailableEnergy();
                const calcCapacity = (workerCount === 0 && energyAvailable < capacity && energyAvailable >= 200) ? energyAvailable : capacity;
                const body = BodyCalc.calculateWorker(calcCapacity);
                const cost = BodyCalc.getCost(body);
                if (spawnLedger.canSpawn(cost)) {
                    SpawnQueueManager.requestSpawn(room.name, 'worker', body, 'worker_' + Game.time, { memory: { role: 'worker', colony: room.name } }, cost);
                }
                const queue = new SpawnQueueManager();
                queue.process(spawns, spawnLedger);
                return;
            }

            // Spawn harvesters first
            const targetHarvesters = room.controller.level <= 4 ? bootstrapReqs.harvester : spawnLedger.calculateHarvesterTarget(room, workerCount);
            if (harvesterCount < targetHarvesters) {
                const energyAvailable = spawnLedger.getAvailableEnergy();
                const calcCapacity = (haulerCount === 0 && energyAvailable < capacity && energyAvailable >= 200) ? energyAvailable : capacity;
                const body = BodyCalc.calculateEarlyGameHarvester(calcCapacity);
                const cost = BodyCalc.getCost(body);
                SpawnQueueManager.requestSpawn(room.name, 'harvester', body, 'harvester_' + Game.time, { memory: { role: 'harvester', colony: room.name } }, cost);
            }

            // Spawn a domestic hauler to move energy from harvesters to spawn/extensions
            // Retire domestic haulers at RCL 5 if a Link network is established
            const targetHaulers = room.controller.level <= 4 ? bootstrapReqs.domesticHauler : 2;
            if (haulerCount < targetHaulers && (!room.controller || room.controller.level < 5 || !spawnLedger.isLinkNetworkPresent(room))) {
                const energyAvailable = spawnLedger.getAvailableEnergy();
                const calcCapacity = (haulerCount === 0 && energyAvailable < capacity && energyAvailable >= 200) ? energyAvailable : capacity;
                const body = BodyCalc.calculateDomesticHauler(calcCapacity);
                const cost = BodyCalc.getCost(body);
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
                if (spawnLedger.canSpawn(50)) {
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

        let desiredUpgraders = room.controller.level <= 4 ? bootstrapReqs.upgrader : spawnLedger.calculateUpgraderTarget(room, harvesterCount);
        if (room.controller.level >= 5) {
            desiredUpgraders = UpgraderManager.getDesiredCount(room);
        }

        if (upgraderCount < desiredUpgraders) {
            const body = BodyCalc.calculateUpgrader(capacity);
            const cost = BodyCalc.getCost(body);
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

                if (hubManagerCount < 1) {
                    const body = [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE];
                    const cost = (16 * BODYPART_COST[CARRY]) + BODYPART_COST[MOVE];
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
        const desiredFastFillers = spawnLedger.calculateFastFillerTarget(room);

        if (fastFillerCount < desiredFastFillers) {
            let body = [];
            let cost = 0;
            const pairCost = BODYPART_COST[CARRY] + BODYPART_COST[MOVE];
            while (cost + pairCost <= capacity && body.length < 50) {
                body.push(CARRY, MOVE);
                cost += pairCost;
            }

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
                            const body = [CLAIM, MOVE];
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
                                const sourceCapacity = (intel.reservation === 'jules' || activeReserver) ? 3000 : 1500;
                                const body = BodyCalc.calculateRemoteMiner(capacity, sourceCapacity);
                                const cost = BodyCalc.getCost(body);
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
