const ActionConstants = require('../constants/ActionConstants');

/**
 * V8 Optimized Monomorphic Creep Heap
 * Defines all possible properties upfront to ensure hidden class stability.
 */
class CreepHeap {
    constructor() {
        this.state = 'idle';
        this.targetId = null;
        this.actionIntent = ActionConstants.ACTION_IDLE;
        this.harvestPosition = null;
        this.sleepUntil = 0;
        this.sitTargetId = null;
        this.secondaryTargetId = null;
        this.waypointPos = null;
        this.waypointIndex = 0;
        this.destination = null; // TrafficManager destination {x, y, roomName, range}
        this.fleePos = null;
        this.tooClose = false;
        this.targetRoom = null;
        this.unreachableTargetId = null; // Bugfix for infinite pathing loops
    }
}

class CreepHeapUtility {
    /**
     * Gets the default heap structure for a creep.
     * @returns {CreepHeap}
     */
    static getDefaultHeap() {
        return new CreepHeap();
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
        if (!creep || !creep.heap) return ActionConstants.ACTION_IDLE;
        return creep.heap.actionIntent || ActionConstants.ACTION_IDLE;
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

    /**
     * Safely gets the assigned harvestPosition from the creep's heap.
     * @param {Creep} creep
     * @returns {RoomPosition|null}
     */
    static getCreepHarvestPosition(creep) {
        if (!creep || !creep.heap) return null;
        return creep.heap.harvestPosition || null;
    }

    /**
     * Safely sets the assigned harvestPosition on the creep's heap.
     * @param {Creep} creep
     * @param {RoomPosition|null} pos
     */
    static setCreepHarvestPosition(creep, pos) {
        if (!creep) return;
        if (!creep.heap) creep.heap = CreepHeapUtility.getDefaultHeap();
        creep.heap.harvestPosition = pos;
    }
}

module.exports = CreepHeapUtility;
