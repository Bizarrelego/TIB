class CreepCensusUtility {
    static getCensus() {
        const counts = {};
        for (const creepName in Game.creeps) {
            const role = Game.creeps[creepName].memory.role;
            if (counts[role] === undefined) {
                counts[role] = 1;
            } else {
                counts[role]++;
            }
        }
        return counts;
    }
}
module.exports = CreepCensusUtility;
