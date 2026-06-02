class CreepFatigueUtility {
    static checkFatigue(creep) {
        return creep.fatigue > 0;
    }
}

module.exports = CreepFatigueUtility;
