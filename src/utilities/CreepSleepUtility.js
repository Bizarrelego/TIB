class CreepSleepUtility {
    /**
     * Calculates the sleep time based on source regeneration and puts the creep to sleep.
     * @param {Creep} creep - The creep to put to sleep.
     * @param {Source} source - The source being mined.
     */
    static sleepOnSourceRegeneration(creep, source) {
        if (!creep || !creep.heap || !source || source.ticksToRegeneration === undefined) return;
        const sleepUntil = Game.time + source.ticksToRegeneration;
        creep.heap.state = 'sleeping';
        creep.heap.sleepUntil = sleepUntil;
    }
}

module.exports = CreepSleepUtility;
