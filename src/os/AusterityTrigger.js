/**
 * Module responsible for analyzing the CPU bucket forecast and determining
 * when to activate austerity modes via AusterityManager.js.
 * @module os/AusterityTrigger
 */

const cpuBucketForecaster = require('./cpuBucketForecaster');
const AusterityManager = require('./AusterityManager');

const AUSTERITY_THRESHOLD = 500;
const DRAIN_RATE_THRESHOLD = -20; // Losing more than 20 bucket per tick on average
const FORECAST_TICKS = 10;

/**
 * Evaluates the CPU bucket forecast and determines if austerity should be triggered.
 * @returns {boolean} True if austerity should be triggered.
 */
function shouldTriggerAusterity() {
    if (cpuBucketForecaster.getHistoryLength() < 5) return false; // Need enough data

    const currentBucket = cpuBucketForecaster.getCurrentBucket();
    if (currentBucket < AUSTERITY_THRESHOLD) return true; // Already below threshold

    const drainRate = cpuBucketForecaster.getDrainRate();

    // If we're draining fast and will hit threshold soon (e.g. 10 ticks)
    if (drainRate < DRAIN_RATE_THRESHOLD) {
        const forecasted10Ticks = cpuBucketForecaster.getForecastedBucket(FORECAST_TICKS);
        if (forecasted10Ticks < AUSTERITY_THRESHOLD) {
            return true;
        }
    }

    return false;
}

/**
 * Evaluates the CPU bucket forecast and activates or deactivates austerity mode via AusterityManager.
 * @returns {boolean} True if austerity mode is active.
 */
function evaluateAndTriggerAusterity() {
    const shouldTrigger = shouldTriggerAusterity();

    if (shouldTrigger && !AusterityManager.isActive()) {
        AusterityManager.activate();
    } else if (!shouldTrigger && AusterityManager.isActive()) {
        AusterityManager.deactivate();
    }

    return AusterityManager.isActive();
}

module.exports = {
    shouldTriggerAusterity,
    evaluateAndTriggerAusterity
};
