class CreepCensusUtility {
    static getCensus() {
        const counts = new Map();
        for (const creepName in Game.creeps) {
            const creep = Game.creeps[creepName];
            const role = creep.memory.role;

            // Pre-emptive Spawning: Ignore creeps that are about to die so their replacements spawn early
            if (creep.ticksToLive !== undefined) {
                const spawnTicks = creep.body.length * 3;
                // Add a 30-tick travel buffer to the spawn time
                if (creep.ticksToLive < spawnTicks + 30) {
                    continue; // Do not count this creep, tricking the spawner into replacing it now
                }
            }

            if (!counts.has(role)) {
                counts.set(role, 1);
            } else {
                counts.set(role, counts.get(role) + 1);
            }
        }
        return counts;
    }
}
module.exports = CreepCensusUtility;
