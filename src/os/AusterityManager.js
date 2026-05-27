/**
 * Module responsible for interpreting CPU forecasts and triggering austerity measures.
 * Coordinates with SystemScheduler and cpuThrottler to reduce CPU usage preemptively.
 * @module os/AusterityManager
 */

const Logger = require('../utils/logger');

const { LEVELS } = require('./AusterityDecisionEngine');

let currentLevel = LEVELS.NONE;

/**
 * Activates austerity mode with the given level and logs the activation.
 * @param {import('./AusterityDecisionEngine').AusterityLevel} level - The level of austerity to activate.
 */
function activate(level) {
    if (currentLevel !== level) {
        currentLevel = level;
        Logger.info(`[AusterityManager] 🚨 CPU Austerity Mode ACTIVATED (${level}) - Reducing tick rates and throttling operations.`);
    }
}

/**
 * Deactivates austerity mode and logs the deactivation.
 */
function deactivate() {
    if (currentLevel !== LEVELS.NONE) {
        currentLevel = LEVELS.NONE;
        Logger.info('[AusterityManager] ✅ CPU Austerity Mode DEACTIVATED - Resuming normal operations.');
    }
}

/**
 * Evaluates the CPU bucket forecast and toggles austerity mode.
 * Should be called early in the main loop before other managers.
 * @returns {boolean} True if austerity mode is active.
 */
function run() {
    const AusterityTrigger = require('./AusterityTrigger');
    try {
        AusterityTrigger.evaluateAndTriggerAusterity();
    } catch (e) {
        Logger.error(`[AusterityManager] Error evaluating austerity trigger: ${e.stack}`);
    }

    return isActive();
}

/**
 * Returns the current state of austerity mode.
 * @returns {boolean} True if any level of austerity is active.
 */
function isActive() {
    return currentLevel !== LEVELS.NONE;
}

/**
 * Returns the current austerity level.
 * @returns {import('./AusterityDecisionEngine').AusterityLevel} The active austerity level.
 */
function getLevel() {
    return currentLevel;
}

/**
 * Resets the internal state (useful for testing or global resets).
 */
function reset() {
    currentLevel = LEVELS.NONE;
}

module.exports = {
    run,
    isActive,
    getLevel,
    reset,
    activate,
    deactivate
};
