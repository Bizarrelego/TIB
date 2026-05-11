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
        let roomCreepsCount = 0;
        const roomCreeps = global.State.creepsByRoom.get(room.name);
        if (roomCreeps) {
            for (const roleCreeps of roomCreeps.values()) {
                roomCreepsCount += roleCreeps.length;
            }
        }

        if (roomCreepsCount < 15 && spawnLedger.canSpawn(200)) {
            const result = spawn.spawnCreep([WORK, CARRY, MOVE], 'worker_' + Game.time, {
                memory: { role: 'worker', colony: room.name }
            });

            if (result === OK) {
                spawnLedger.deduct(200);
            }
        }
    }
};
