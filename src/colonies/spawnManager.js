const planner = require('./planner');

module.exports = {
    run: function(room, spawnLedger) {
        // Retrieve spawn via O(1) lookup
        const spawn = global.State.spawnsByRoom.get(room.name)?.[0];

        if (!spawn) {
            return;
        }

        if (spawn.spawning) {
            return;
        }

        // Check creeps count in this room via O(1) lookup
        const roomCreeps = global.State.creepsByRoom.get(room.name);

        const capacity = room.energyCapacityAvailable;

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
                        const result = spawn.spawnCreep(body, 'hubManager_' + Game.time, {
                            memory: { role: 'hubManager', colony: room.name }
                        });

                        if (result === OK) {
                            spawnLedger.deduct(cost);
                        }
                        return; // Prioritize hubManager over other logistics
                    }
                }

                if (upgraderCount < 1) {
                    // Static upgrader body
                    const body = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, MOVE];
                    const cost = 950;
                    if (spawnLedger.canSpawn(cost)) {
                        const result = spawn.spawnCreep(body, 'upgrader_' + Game.time, {
                            memory: { role: 'upgrader', colony: room.name }
                        });

                        if (result === OK) {
                            spawnLedger.deduct(cost);
                        }
                        return; // Prioritize upgrader over other logistics
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

                    if (body.length > 0 && spawnLedger.canSpawn(cost)) {
                        const result = spawn.spawnCreep(body, 'fastFiller_' + Game.time, {
                            memory: { role: 'fastFiller', colony: room.name }
                        });

                        if (result === OK) {
                            spawnLedger.deduct(cost);
                        }
                        return; // Prioritize fastFillers
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

            if (workerCount < 15 && spawnLedger.canSpawn(200)) {
                const result = spawn.spawnCreep([WORK, CARRY, MOVE], 'worker_' + Game.time, {
                    memory: { role: 'worker', colony: room.name }
                });

                if (result === OK) {
                    spawnLedger.deduct(200);
                }
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

            // Prioritize Harvesters
            if (harvesterCount < 2 && spawnLedger.canSpawn(500)) {
                const result = spawn.spawnCreep([WORK, WORK, WORK, WORK, CARRY, MOVE], 'harvester_' + Game.time, {
                    memory: { role: 'harvester', colony: room.name }
                });

                if (result === OK) {
                    spawnLedger.deduct(500);
                }
                return; // Stop checking haulers if we just spawned a harvester or are prioritizing it
            }

            if (haulerCount < 4 && spawnLedger.canSpawn(500)) {
                const result = spawn.spawnCreep([CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE], 'hauler_' + Game.time, {
                    memory: { role: 'hauler', colony: room.name }
                });

                if (result === OK) {
                    spawnLedger.deduct(500);
                }
            }
        }
    }
};
