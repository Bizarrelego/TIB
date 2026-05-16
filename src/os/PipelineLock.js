/**
 * @file PipelineLock.js
 * @description Manages pipeline locks for creep actions to prevent engine overwrites.
 * A creep can only execute one intent per pipeline (Movement, Melee, Ranged, Utility) per tick.
 */

/**
 * Valid pipeline types for intent locking.
 * @enum {string}
 */
const PIPELINES = {
    MOVEMENT: 'MOVEMENT',
    MELEE: 'MELEE',
    RANGED: 'RANGED',
    UTILITY: 'UTILITY'
};

/**
 * PipelineLock class to manage intent locks for creeps.
 */
class PipelineLock {
    constructor() {
        /**
         * @type {Map<string, Set<string>>} Map of creepId to a Set of locked pipelines.
         */
        this.locks = new Map();
    }

    /**
     * Initializes the state if it doesn't exist, using global.State if we wanted, but as a class
     * it might manage its own map. The prompt implies it's a class to manage pipeline locks.
     */

    /**
     * Checks if a creep already has a lock for a specific pipeline.
     * @param {string} creepId - The ID of the creep.
     * @param {string} pipelineType - The pipeline type (MOVEMENT, MELEE, RANGED, UTILITY).
     * @returns {boolean} True if the lock is held, false otherwise.
     */
    hasLock(creepId, pipelineType) {
        if (!this.locks.has(creepId)) {
            return false;
        }
        return this.locks.get(creepId).has(pipelineType);
    }

    /**
     * Attempts to acquire a lock for a specific pipeline for a creep.
     * @param {string} creepId - The ID of the creep.
     * @param {string} pipelineType - The pipeline type (MOVEMENT, MELEE, RANGED, UTILITY).
     * @returns {boolean} True if lock was acquired, false if it was already locked.
     */
    acquireLock(creepId, pipelineType) {
        if (this.hasLock(creepId, pipelineType)) {
            return false;
        }

        if (!this.locks.has(creepId)) {
            this.locks.set(creepId, new Set());
        }

        this.locks.get(creepId).add(pipelineType);
        return true;
    }

    /**
     * Clears all locks. Should be called at the start or end of the tick.
     * @returns {void}
     */
    clear() {
        this.locks.clear();
    }
}

module.exports = {
    PipelineLock,
    PIPELINES
};
