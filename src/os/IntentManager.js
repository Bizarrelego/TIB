/**
 * @file IntentManager.js
 * @description Responsible for registering and processing creep intents.
 * Implements a mechanism with PipelineLock to prevent conflicting intents within a tick.
 * Refactored to act strictly as a Virtual Ledger for tracking resources and spawning constraints.
 */

const { PipelineLock, PIPELINES } = require('./PipelineLock');

/**
 * @typedef {Object} Intent
 * @property {string} creepId - The ID of the creep executing the action.
 * @property {string} action - The action string (e.g., 'move', 'attack', 'heal', 'harvest').
 * @property {string} [targetId] - The ID of the target object, if applicable.
 * @property {Object} [args] - Additional arguments for the action.
 */

class IntentManager {
    constructor() {
        /**
         * @type {PipelineLock} The pipeline lock manager.
         */
        this.pipelineLock = new PipelineLock();
    }

    /**
     * Maps a game action to its respective pipeline.
     * @param {string} action - The action string (e.g., 'move', 'attack', 'heal').
     * @returns {string|null} The pipeline type, or null if not recognized.
     */
    getPipelineForAction(action) {
        switch (action) {
            case 'move':
            case 'moveTo':
            case 'moveByPath':
                return PIPELINES.MOVEMENT;
            case 'attack':
            case 'dismantle':
                return PIPELINES.MELEE;
            case 'rangedAttack':
            case 'rangedHeal':
            case 'rangedMassAttack':
                return PIPELINES.RANGED;
            case 'heal':
            case 'build':
            case 'repair':
            case 'upgradeController':
            case 'harvest':
            case 'transfer':
            case 'withdraw':
            case 'pickup':
            case 'drop':
            case 'claimController':
            case 'reserveController':
            case 'attackController':
            case 'generateSafeMode':
                return PIPELINES.UTILITY;
            default:
                return null;
        }
    }

    /**
     * Registers an intent as a pipeline lock to act as a virtual ledger.
     * Does NOT buffer or execute the action itself.
     * @param {string} creepId - The ID of the creep.
     * @param {string} action - The action to perform.
     * @returns {boolean} True if the pipeline is acquired.
     */
    registerIntent(creepId, action) {
        const pipeline = this.getPipelineForAction(action);

        if (!pipeline) {
            return true;
        }

        return this.pipelineLock.acquireLock(creepId, pipeline);
    }

    /**
     * Clears all pipeline locks. Called at the end of the tick.
     * @returns {void}
     */
    executeIntents() {
        // Clear state for the next tick
        this.pipelineLock.clear();
    }
}

module.exports = IntentManager;
