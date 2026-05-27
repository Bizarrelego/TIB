/**
 * Module responsible for analyzing the CPU bucket forecast and determining
 * when to activate austerity modes via AusterityManager.js.
 * @module os/AusterityTrigger
 */

const cpuBucketForecaster = require('./cpuBucketForecaster');
const AusterityManager = require('./AusterityManager');
const AusterityDecisionEngine = require('./AusterityDecisionEngine');

const FORECAST_TICKS = 10;

/**
 * Evaluates the CPU bucket forecast and determines the required austerity level.
 * @returns {import('./AusterityDecisionEngine').AusterityLevel} The determined austerity level.
 */
function getRequiredAusterityLevel() {
    if (cpuBucketForecaster.getHistoryLength() < 5) return AusterityDecisionEngine.LEVELS.NONE;

    const currentBucket = cpuBucketForecaster.getCurrentBucket();
    const drainRate = cpuBucketForecaster.getDrainRate();
    const forecasted10Ticks = cpuBucketForecaster.getForecastedBucket(FORECAST_TICKS);

    return AusterityDecisionEngine.shouldActivateAusterity(currentBucket, forecasted10Ticks, drainRate);
}

/**
 * Evaluates the CPU bucket forecast and determines if austerity should be triggered.
 * Maintained for backward compatibility.
 * @returns {boolean} True if austerity should be triggered.
 */
function shouldTriggerAusterity() {
    const level = getRequiredAusterityLevel();
    return level !== AusterityDecisionEngine.LEVELS.NONE;
}

/**
 * Evaluates the CPU bucket forecast and activates or deactivates austerity mode via AusterityManager.
 * @returns {boolean} True if austerity mode is active.
 */
function evaluateAndTriggerAusterity() {
    const level = getRequiredAusterityLevel();

    if (level !== AusterityDecisionEngine.LEVELS.NONE) {
        // Will only log activation if the level changes (handled internally by AusterityManager)
        AusterityManager.activate(level);
    } else {
        AusterityManager.deactivate();
    }

    return AusterityManager.isActive();
}

module.exports = {
    shouldTriggerAusterity,
    evaluateAndTriggerAusterity
};
