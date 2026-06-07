class CreepCensusUtility {
    static getCensus() {
        const counts = new Map();
        for (const creepName in Game.creeps) {
            const role = Game.creeps[creepName].memory.role;
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
