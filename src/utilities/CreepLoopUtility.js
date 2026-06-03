class CreepLoopUtility {
    /**
     * Determines if a creep should continue its logic for the current tick.
     * @param {Creep} creep
     * @returns {boolean}
     */
    static shouldCreepRun(creep) {
        if (creep.fatigue > 0) {
            return false;
        }

        if (creep.heap && creep.heap.sleepUntil && Game.time < creep.heap.sleepUntil) {
            return false;
        }

        return true;
    }
}

module.exports = CreepLoopUtility;
