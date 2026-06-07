class CreepStateManagementUtility {
    /**
     * Sets the creep's state to idle.
     * @param {Creep} creep
     */
    static setIdle(creep) {
        if (!creep || !creep.heap) return;
        creep.heap.state = 'idle';
    }

    /**
     * Sets the creep's state to sleeping until a specific tick.
     * @param {Creep} creep
     * @param {number} untilTick
     */
    static setSleeping(creep, untilTick) {
        if (!creep || !creep.heap) return;
        creep.heap.state = 'sleeping';
        creep.heap.sleepUntil = untilTick;
    }
}

module.exports = CreepStateManagementUtility;
