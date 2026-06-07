/**
 * Utility for checking if a creep is currently fatigued.
 */
const CreepFatigueUtility = {
    /**
     * Determines if a given creep is fatigued.
     * @param {Creep} creep - The creep to check.
     * @returns {boolean} True if the creep's fatigue is greater than 0, false otherwise.
     */
    isFatigued: function(creep) {
        if (!creep) return false;
        return creep.fatigue > 0;
    }
};

module.exports = CreepFatigueUtility;
