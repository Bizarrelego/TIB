class CreepHeapUtility {
    /**
     * Gets the default heap structure for a creep.
     * @returns {Object}
     */
    static getDefaultHeap() {
        return { state: 'idle', targetId: null, actionIntent: null };
    }

    /**
     * Safely gets the current state from the creep's heap.
     * @param {Creep} creep
     * @returns {string}
     */
    static getCreepState(creep) {
        if (!creep || !creep.heap) return 'idle';
        return creep.heap.state || 'idle';
    }

    /**
     * Safely sets the state on the creep's heap.
     * @param {Creep} creep
     * @param {string} state
     */
    static setCreepState(creep, state) {
        if (!creep) return;
        if (!creep.heap) creep.heap = CreepHeapUtility.getDefaultHeap();
        creep.heap.state = state;
    }

    /**
     * Safely gets the targetId from the creep's heap.
     * @param {Creep} creep
     * @returns {string|null}
     */
    static getCreepTargetId(creep) {
        if (!creep || !creep.heap) return null;
        return creep.heap.targetId || null;
    }

    /**
     * Safely sets the targetId on the creep's heap.
     * @param {Creep} creep
     * @param {string|null} id
     */
    static setCreepTargetId(creep, id) {
        if (!creep) return;
        if (!creep.heap) creep.heap = CreepHeapUtility.getDefaultHeap();
        creep.heap.targetId = id;
    }

    /**
     * Safely gets the actionIntent from the creep's heap.
     * @param {Creep} creep
     * @returns {string|null}
     */
    static getCreepActionIntent(creep) {
        if (!creep || !creep.heap) return null;
        return creep.heap.actionIntent || null;
    }

    /**
     * Safely sets the actionIntent on the creep's heap.
     * @param {Creep} creep
     * @param {string|null} intent
     */
    static setCreepActionIntent(creep, intent) {
        if (!creep) return;
        if (!creep.heap) creep.heap = CreepHeapUtility.getDefaultHeap();
        creep.heap.actionIntent = intent;
    }
}

module.exports = CreepHeapUtility;
