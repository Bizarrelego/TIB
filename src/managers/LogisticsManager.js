const haulerRole = require('../colonies/hauler');
const fastFillerRole = require('../roles/fastFiller');

module.exports = {
    run: function(room, spawnLedger) {
        try {
            const roomCreeps = global.State.creepsByRoom.get(room.name);
            const structures = global.State.structuresByRoom.get(room.name);
            const spawns = global.State.spawnsByRoom.get(room.name);

            let hasStorage = false;
            if (structures) {
                const storages = structures.get(STRUCTURE_STORAGE) || [];
                if (storages.length > 0) {
                    hasStorage = true;
                }
            }

            // Execute logic
            if (!hasStorage) {
                // Pre-Storage logic
                let haulerCount = 0;
                if (roomCreeps) {
                    const haulers = roomCreeps.get('hauler');
                    if (haulers) {
                        haulerCount = haulers.length;
                    }
                }

                if (haulerCount < 4 && spawns && spawns.length > 0) {
                    const spawn = spawns[0];
                    if (!spawn.spawning) {
                        if (spawnLedger.canSpawn(500)) {
                            const result = spawn.spawnCreep([CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE], 'hauler_' + Game.time, {
                                memory: { role: 'hauler', colony: room.name }
                            });

                            if (result === OK) {
                                spawnLedger.deduct(500);
                            }
                        }
                    }
                }
            } else {
                // RCL 4 Transition to fastFiller
                let fastFillerCount = 0;
                if (roomCreeps) {
                    const fastFillers = roomCreeps.get('fastFiller');
                    if (fastFillers) {
                        fastFillerCount = fastFillers.length;
                    }
                }

                if (fastFillerCount < 2 && spawns && spawns.length > 0) {
                    const spawn = spawns[0];
                    if (!spawn.spawning) {
                        // Dynamic Body Calculus for fastFiller (1:1 CARRY:MOVE)
                        // Max cost let's say up to room capacity, but capped at e.g., 16 CARRY, 16 MOVE (1600 energy)
                        const capacity = room.energyCapacityAvailable;
                        let targetEnergy = Math.min(capacity, 1600);
                        // Make sure we have at least 100 energy for 1 CARRY 1 MOVE
                        if (targetEnergy >= 100) {
                            let partsCount = Math.floor(targetEnergy / 100);
                            let body = [];
                            for (let i = 0; i < partsCount; i++) {
                                body.push(CARRY);
                            }
                            for (let i = 0; i < partsCount; i++) {
                                body.push(MOVE);
                            }

                            const cost = partsCount * 100;

                            if (spawnLedger.canSpawn(cost)) {
                                const result = spawn.spawnCreep(body, 'fastFiller_' + Game.time, {
                                    memory: { role: 'fastFiller', colony: room.name }
                                });

                                if (result === OK) {
                                    spawnLedger.deduct(cost);
                                }
                            }
                        }
                    }
                }

                // Still need some haulers to bring energy to storage from harvesters or dropped
                // Let's keep 2 haulers
                let haulerCount = 0;
                if (roomCreeps) {
                    const haulers = roomCreeps.get('hauler');
                    if (haulers) {
                        haulerCount = haulers.length;
                    }
                }

                if (haulerCount < 2 && spawns && spawns.length > 0) {
                    const spawn = spawns[0];
                    if (!spawn.spawning) {
                        // Regular hauler body for now or dynamic
                        if (spawnLedger.canSpawn(500)) {
                            const result = spawn.spawnCreep([CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE], 'hauler_' + Game.time, {
                                memory: { role: 'hauler', colony: room.name }
                            });

                            if (result === OK) {
                                spawnLedger.deduct(500);
                            }
                        }
                    }
                }

                // Run fastFiller logic
                fastFillerRole.run(room);
            }

            // Run hauler logic (always needed to pick up energy)
            haulerRole.run(room);

        } catch (e) {
            console.log(`[LogisticsManager Error] Room ${room.name}: ${e.stack}`);
        }
    }
};
