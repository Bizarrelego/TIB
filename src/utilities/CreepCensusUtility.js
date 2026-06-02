class CreepCensusUtility {
    static getCensus() {
        const counts = { harvester: 0, hauler: 0, upgrader: 0 };
        for (const creepName in Game.creeps) {
            const role = Game.creeps[creepName].memory.role;
            if (counts[role] !== undefined) {
                counts[role]++;
            }
        }
        return counts;
    }
}
module.exports = CreepCensusUtility;
