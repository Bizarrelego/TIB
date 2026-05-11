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
