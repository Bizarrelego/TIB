class CreepHeapUtility {
    /**
     * Gets the default heap structure for a creep.
     * @returns {Map}
     */
    static getDefaultHeap() {
        const heap = new Map();
        heap.set('state', 'idle');
        heap.set('targetId', null);
        heap.set('actionIntent', null);
        return heap;
    }

    /**
     * Safely gets the current state from the creep's heap.
     * @param {Creep} creep
     * @returns {string}
     */
    static getCreepState(creep) {
        if (!creep || !creep.heap) return 'idle';
        return creep.heap.get('state') || 'idle';
    }

    /**
     * Safely sets the state on the creep's heap.
     * @param {Creep} creep
     * @param {string} state
     */
    static setCreepState(creep, state) {
        if (!creep) return;
        if (!creep.heap) creep.heap = CreepHeapUtility.getDefaultHeap();
        creep.heap.set('state', state);
    }

    /**
     * Safely gets the targetId from the creep's heap.
     * @param {Creep} creep
     * @returns {string|null}
     */
    static getCreepTargetId(creep) {
        if (!creep || !creep.heap) return null;
        return creep.heap.get('targetId') || null;
    }

    /**
     * Safely sets the targetId on the creep's heap.
     * @param {Creep} creep
     * @param {string|null} id
     */
    static setCreepTargetId(creep, id) {
        if (!creep) return;
        if (!creep.heap) creep.heap = CreepHeapUtility.getDefaultHeap();
        creep.heap.set('targetId', id);
    }

    /**
     * Safely gets the actionIntent from the creep's heap.
     * @param {Creep} creep
     * @returns {string|null}
     */
    static getCreepActionIntent(creep) {
        if (!creep || !creep.heap) return null;
        return creep.heap.get('actionIntent') || null;
    }

    /**
     * Safely sets the actionIntent on the creep's heap.
     * @param {Creep} creep
     * @param {string|null} intent
     */
    static setCreepActionIntent(creep, intent) {
        if (!creep) return;
        if (!creep.heap) creep.heap = CreepHeapUtility.getDefaultHeap();
        creep.heap.set('actionIntent', intent);
    }
}

module.exports = CreepHeapUtility;
