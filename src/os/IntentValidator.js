const { PipelineLock } = require('./PipelineLock');
const IntentManager = require('./IntentManager');
const { INTENT_PRIORITIES } = require('../constants/intentPriorities');

class IntentValidator {
    /**
     * Validates and resolves conflicts in a list of proposed creep intents.
     * @param {Array<Object>} creepIntents - List of raw creep intents.
     * @returns {Array<Object>} - Filtered list of executable intents.
     */
    validateAndResolve(creepIntents) {
        if (!creepIntents || !Array.isArray(creepIntents)) {
            return [];
        }

        const validIntents = [];
        const intentsByCreep = new Map();

        // Group intents by creepId
        for (const intent of creepIntents) {
            if (!intent || !intent.creepId) continue;
            if (!intentsByCreep.has(intent.creepId)) {
                intentsByCreep.set(intent.creepId, []);
            }
            intentsByCreep.get(intent.creepId).push(intent);
        }

        const intentManager = new IntentManager();

        for (const [creepId, intents] of intentsByCreep.entries()) {
            // Sort intents descending by priority
            intents.sort((a, b) => {
                const prioA = INTENT_PRIORITIES.get(a.action) || 0;
                const prioB = INTENT_PRIORITIES.get(b.action) || 0;
                return prioB - prioA;
            });

            const pipelineLock = new PipelineLock();
            const targetActions = new Map();
            let moveTargetId = null;

            for (const intent of intents) {
                const action = intent.action;
                const pipeline = intentManager.getPipelineForAction(action);

                // If it doesn't have a known pipeline, allow it through (though unlikely to happen)
                if (pipeline && pipelineLock.hasLock(creepId, pipeline)) {
                    continue;
                }

                let discard = false;
                const targetId = intent.targetId;

                if (targetId) {
                    // Custom conflict: Disallow moving to and melee attacking the same target
                    if (['move', 'moveTo', 'moveByPath'].includes(action)) {
                        if (targetActions.has(targetId) && targetActions.get(targetId).has('attack')) {
                            discard = true;
                        } else {
                            moveTargetId = targetId;
                        }
                    } else if (action === 'attack') {
                        if (moveTargetId === targetId) {
                            discard = true;
                        }
                    }

                    // Custom conflict: Disallow attack and heal on the same target
                    if (action === 'attack' && targetActions.has(targetId) && targetActions.get(targetId).has('heal')) {
                        discard = true;
                    } else if (action === 'heal' && targetActions.has(targetId) && targetActions.get(targetId).has('attack')) {
                        discard = true;
                    }

                    // Custom conflict: Disallow withdraw and transfer on the same target
                    if (action === 'withdraw' && targetActions.has(targetId) && targetActions.get(targetId).has('transfer')) {
                        discard = true;
                    } else if (action === 'transfer' && targetActions.has(targetId) && targetActions.get(targetId).has('withdraw')) {
                        discard = true;
                    }
                }

                if (!discard) {
                    if (pipeline) {
                        pipelineLock.acquireLock(creepId, pipeline);
                    }

                    if (targetId) {
                        if (!targetActions.has(targetId)) {
                            targetActions.set(targetId, new Set());
                        }
                        targetActions.get(targetId).add(action);
                    }

                    validIntents.push(intent);
                }
            }
        }

        return validIntents;
    }
}

module.exports = IntentValidator;
