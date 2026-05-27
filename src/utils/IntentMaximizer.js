/**
 * @file IntentMaximizer.js
 * @description Utility module to maximize non-conflicting creep intents in a single tick.
 */

const { INTENT_PRIORITIES, PIPELINES } = require('../constants/intentPriorities');

/**
 * @typedef {Object} Intent
 * @property {string} creepId - The ID of the creep executing the action.
 * @property {string} action - The action string (e.g., 'move', 'attack', 'heal', 'harvest').
 * @property {string} [targetId] - The ID of the target object, if applicable.
 * @property {Object} [args] - Additional arguments for the action.
 */

/**
 * Maps a game action to its respective pipeline.
 * Main-thread actions that conflict in the Screeps engine are grouped to prevent engine overwrites.
 *
 * @param {string} action - The action string.
 * @returns {string|null} The pipeline type, or null if not recognized.
 */
function getPipelineForAction(action) {
    switch (action) {
        case 'move':
        case 'moveTo':
        case 'moveByPath':
            return PIPELINES.MOVEMENT;

        // Ranged actions have their own pipeline in Screeps and can be fired concurrently with move/utility
        case 'rangedAttack':
        case 'rangedHeal':
        case 'rangedMassAttack':
            return PIPELINES.RANGED;

        // Logistics actions do not conflict with main actions (e.g., withdraw + upgrade is allowed)
        case 'transfer':
        case 'withdraw':
        case 'pickup':
        case 'drop':
            return PIPELINES.LOGISTICS;

        // Main actions conflict and compete for the same execution slot. We group them under UTILITY
        case 'attack':
        case 'dismantle':
        case 'heal':
        case 'build':
        case 'repair':
        case 'upgradeController':
        case 'harvest':
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
 * Takes a list of potential creep intents and identifies the optimal set of non-conflicting intents.
 *
 * @param {Object} creep - The creep object for which intents are being evaluated.
 * @param {Intent[]} potentialIntents - An array of potential intents the creep wishes to perform.
 * @returns {Intent[]} An array of prioritized, non-conflicting intents to execute.
 */
function maximizeIntents(creep, potentialIntents) {
    if (!creep || !potentialIntents || !potentialIntents.length) {
        return [];
    }

    // Sort intents by priority descending
    const sortedIntents = [...potentialIntents].sort((a, b) => {
        const priorityA = INTENT_PRIORITIES[a.action] || 0;
        const priorityB = INTENT_PRIORITIES[b.action] || 0;
        return priorityB - priorityA;
    });

    const lockedPipelines = new Set();
    const finalIntents = [];

    for (const intent of sortedIntents) {
        const pipeline = getPipelineForAction(intent.action);

        if (!pipeline) {
            // If the action doesn't map to a pipeline, it doesn't conflict, so just add it.
            finalIntents.push(intent);
        } else if (!lockedPipelines.has(pipeline)) {
            // If the pipeline is not locked yet, add the intent and lock the pipeline.
            finalIntents.push(intent);
            lockedPipelines.add(pipeline);
        }
    }

    return finalIntents;
}

module.exports = {
    maximizeIntents,
    getPipelineForAction
};
