/**
 * Module responsible for interpreting CPU forecasts and triggering austerity measures.
 * Coordinates with SystemScheduler and cpuThrottler to reduce CPU usage preemptively.
 * @module os/AusterityManager
 */

const Logger = require('../utils/logger');
const cpuBucketForecaster = require('./cpuBucketForecaster');

let isAusterityActive = false;

/**
 * Evaluates the CPU bucket forecast and toggles austerity mode.
 * Should be called early in the main loop before other managers.
 * @returns {boolean} True if austerity mode is active.
 */
function run() {
    let shouldTrigger = false;
    try {
        shouldTrigger = cpuBucketForecaster.shouldTriggerAusterity();
    } catch (e) {
        Logger.error(`[AusterityManager] Error checking forecaster: ${e.stack}`);
    }

    if (shouldTrigger && !isAusterityActive) {
        isAusterityActive = true;
        Logger.info('[AusterityManager] 🚨 CPU Austerity Mode ACTIVATED - Reducing tick rates and throttling operations.');
    } else if (!shouldTrigger && isAusterityActive) {
        isAusterityActive = false;
        Logger.info('[AusterityManager] ✅ CPU Austerity Mode DEACTIVATED - Resuming normal operations.');
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
    reset
};
