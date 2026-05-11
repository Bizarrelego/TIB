module.exports = {
    run: function(room, spawnLedger) {
        // Find spawn via O(1) loop, NOT room.find
        const spawn = Object.values(Game.spawns).find(s => s.room.name === room.name);

        if (!spawn) {
            return;
        }

        if (spawn.spawning) {
            return;
        }

        // Check creeps count in this room via O(1) filter
        const roomCreepsCount = Object.values(Game.creeps).filter(c => c.room.name === room.name).length;

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
