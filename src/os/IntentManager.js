/**
 * @file IntentManager.js
 * @description Responsible for registering and processing creep intents.
 * Implements a mechanism with PipelineLock to prevent conflicting intents within a tick.
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

        /**
         * @type {Intent[]} Array of successfully registered intents to be executed.
         */
        this.intents = new Map();
        this.intentIdCounter = 0;
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
     * Registers an intent for a creep if the required pipeline is not already locked.
     * @param {string} creepId - The ID of the creep.
     * @param {string} action - The action to perform.
     * @param {string} [targetId] - The target's ID.
     * @param {Object} [args] - Additional arguments.
     * @returns {boolean} True if the intent was successfully registered, false if rejected due to conflict.
     */
    registerIntent(creepId, action, targetId = null, args = {}) {
        const pipeline = this.getPipelineForAction(action);

        if (!pipeline) {
            console.log(`[IntentManager] Warning: Unknown action pipeline for '${action}'. Registering without lock.`);
            this.intents.set(this.intentIdCounter++, { creepId, action, targetId, args });
            return true;
        }

        if (this.pipelineLock.acquireLock(creepId, pipeline)) {
            this.intents.set(this.intentIdCounter++, { creepId, action, targetId, args });
            return true;
        }

        // Rejected due to conflict
        console.log(`[IntentManager] Rejected intent '${action}' for creep ${creepId}: Pipeline ${pipeline} already locked.`);
        return false;
    }

    /**
     * Executes a single intent.
     * @param {Intent} intent - The intent to execute.
     */
    _executeSingleIntent(intent) {
        const { creepId, action, targetId, args } = intent;
        const creep = Game.getObjectById(creepId);

        if (!creep) return;

        let target = null;
        if (targetId) {
            target = Game.getObjectById(targetId);
        }

        try {
            switch (action) {
                case 'move':
                    creep.move(args.direction);
                    break;
                case 'attack':
                    if (target) creep.attack(target);
                    break;
                case 'dismantle':
                    if (target) creep.dismantle(target);
                    break;
                case 'rangedAttack':
                    if (target) creep.rangedAttack(target);
                    break;
                case 'rangedHeal':
                    if (target) creep.rangedHeal(target);
                    break;
                case 'rangedMassAttack':
                    creep.rangedMassAttack();
                    break;
                case 'heal':
                    if (target) creep.heal(target);
                    break;
                case 'build':
                    if (target) creep.build(target);
                    break;
                case 'repair':
                    if (target) creep.repair(target);
                    break;
                case 'upgradeController':
                    if (target) creep.upgradeController(target);
                    break;
                case 'harvest':
                    if (target) creep.harvest(target);
                    break;
                case 'transfer':
                    if (target) creep.transfer(target, args.resourceType, args.amount);
                    break;
                case 'withdraw':
                    if (target) creep.withdraw(target, args.resourceType, args.amount);
                    break;
                case 'pickup':
                    if (target) creep.pickup(target);
                    break;
                case 'drop':
                    creep.drop(args.resourceType, args.amount);
                    break;
                case 'claimController':
                    if (target) creep.claimController(target);
                    break;
                case 'reserveController':
                    if (target) creep.reserveController(target);
                    break;
                case 'attackController':
                    if (target) creep.attackController(target);
                    break;
                case 'generateSafeMode':
                    if (target) creep.generateSafeMode(target);
                    break;
                default:
                    console.log(`[IntentManager] Unhandled action execution: ${action}`);
                    break;
            }
        } catch (e) {
            console.log(`[IntentManager] Error executing intent ${action} for creep ${creepId}: ${e.stack}`);
        }
    }

    /**
     * Batches and executes all registered intents, then clears queues.
     * Called at the end of the tick (Phase 6).
     * @returns {void}
     */
    executeIntents() {
        for (const intent of this.intents.values()) {
            this._executeSingleIntent(intent);
        }

        // Clear state for the next tick
        this.intents.clear();
        this.intentIdCounter = 0;
        this.pipelineLock.clear();
    }
}

module.exports = IntentManager;
