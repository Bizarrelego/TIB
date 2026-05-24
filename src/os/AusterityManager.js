/**
 * Module responsible for interpreting CPU forecasts and triggering austerity measures.
 * Coordinates with SystemScheduler and cpuThrottler to reduce CPU usage preemptively.
 * @module os/AusterityManager
 */

const Logger = require('../utils/logger');

let isAusterityActive = false;

/**
 * Activates austerity mode and logs the activation.
 */
function activate() {
    isAusterityActive = true;
    Logger.info('[AusterityManager] 🚨 CPU Austerity Mode ACTIVATED - Reducing tick rates and throttling operations.');
}

/**
 * Deactivates austerity mode and logs the deactivation.
 */
function deactivate() {
    isAusterityActive = false;
    Logger.info('[AusterityManager] ✅ CPU Austerity Mode DEACTIVATED - Resuming normal operations.');
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

    return isAusterityActive;
}

/**
 * Returns the current state of austerity mode.
 * @returns {boolean}
 */
function isActive() {
    return isAusterityActive;
}

/**
 * Resets the internal state (useful for testing or global resets).
 */
function reset() {
    isAusterityActive = false;
}

module.exports = {
    run,
    isActive,
    reset,
    activate,
    deactivate
};
