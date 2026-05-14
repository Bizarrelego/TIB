const planner = require('./planner');
const SpawnQueueManager = require('../managers/SpawnQueueManager');

module.exports = {
    /**
     * Runs the spawn manager.
     * @param {Room} room The room to run the spawn manager in.
     * @param {Object} spawnLedger The spawn ledger to use.
     */
    run: function(room, spawnLedger) {
        try {
            // Retrieve spawn via O(1) lookup
            const spawn = global.State.spawnsByRoom.get(room.name)?.[0];

            if (!spawn) {
                return;
            }

            if (spawnLedger.isSpawnBusy(spawn)) {
                return;
            }

            const queue = new SpawnQueueManager();

            // Check creeps count in this room via O(1) lookup
            const roomCreeps = global.State.creepsByRoom.get(room.name);

            const capacity = room.energyCapacityAvailable;

            // Global Scout Spawning Logic (1 active scout globally)
            if (room.controller.level >= 2) {
            let totalScouts = 0;
            for (const crps of global.State.creepsByRoom.values()) {
                const s = crps.get('scout');
                if (s) totalScouts += s.length;
            }

            if (totalScouts < 1) {
                queue.add('scout', [MOVE], 'scout_' + Game.time, {
                    memory: { role: 'scout', colony: room.name }
                }, 50);
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
                    queue.add('hubManager', body, 'hubManager_' + Game.time, {
                        memory: { role: 'hubManager', colony: room.name }
                    }, cost);
                }

                if (upgraderCount < 1) {
                    // Static upgrader body
                    const body = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, MOVE];
                    const cost = 950;
                    queue.add('upgrader', body, 'upgrader_' + Game.time, {
                        memory: { role: 'upgrader', colony: room.name }
                    }, cost);
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
                        queue.add('fastFiller', body, 'fastFiller_' + Game.time, {
                            memory: { role: 'fastFiller', colony: room.name }
                        }, cost);
                    }
                }
            }
        }

        if (capacity < 500) {
            // RCL 1 Logic (< 500 Capacity)
            let workerCount = 0;
            if (roomCreeps) {
                const workers = roomCreeps.get('worker');
                if (workers) {
                    workerCount = workers.length;
                }
            }

            if (workerCount < 15) {
                queue.add('worker', [WORK, CARRY, MOVE], 'worker_' + Game.time, {
                    memory: { role: 'worker', colony: room.name }
                }, 200);
            }
        } else {
            // RCL 2 Logic (>= 500 Capacity)
            let harvesterCount = 0;
            let haulerCount = 0;

            if (roomCreeps) {
                const harvesters = roomCreeps.get('harvester');
                if (harvesters) {
                    harvesterCount = harvesters.length;
                }
                const haulers = roomCreeps.get('hauler');
                if (haulers) {
                    haulerCount = haulers.length;
                }
            }

            if (harvesterCount < 2) {
                queue.add('harvester', [WORK, WORK, WORK, WORK, CARRY, MOVE], 'harvester_' + Game.time, {
                    memory: { role: 'harvester', colony: room.name }
                }, 500);
            }

            if (haulerCount < 4) {
                queue.add('hauler', [CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE], 'hauler_' + Game.time, {
                    memory: { role: 'hauler', colony: room.name }
                }, 500);
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
                            if (capacity >= cost) {
                                queue.add('reserver', body, 'reserver_' + Game.time, {
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
                                if (capacity >= cost) {
                                    queue.add('remoteHarvester', body, 'remoteHarvester_' + Game.time, {
                                        memory: { role: 'remoteHarvester', colony: room.name, targetRoom: targetRoomName, targetSourceId: null }
                                    }, cost);
                                }
                            }

                            const roomRemoteHaulers = colonyRemoteHaulers.filter(c => c.memory.remoteRoom === targetRoomName);

                            if (roomRemoteHaulers.length < roomRemoteHarvesters.length * 2) {
                                const body = [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE];
                                const cost = 450;
                                if (capacity >= cost) {
                                    queue.add('remoteHauler', body, 'remoteHauler_' + Game.time, {
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
            queue.process(spawn, spawnLedger);

        } catch (e) {
            console.log(`[SpawnManager Error] Room ${room.name}: ${e.stack}`);
        }
    }
};
