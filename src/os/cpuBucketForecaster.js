/**
 * Module responsible for tracking and forecasting the CPU bucket trajectory.
 * Tracks bucket over the last 10 ticks and provides early warnings for austerity.
 * @module os/cpuBucketForecaster
 */

const HISTORY_LENGTH = 10;
const AUSTERITY_THRESHOLD = 500;
const DRAIN_RATE_THRESHOLD = -20; // Example: losing more than 20 bucket per tick on average

let bucketHistory = [];

/**
 * Updates the bucket history with the current tick's bucket.
 * Should be called once per tick.
 */
function update() {
    if (typeof Game !== 'undefined' && Game.cpu && Game.cpu.bucket !== undefined) {
        bucketHistory.push(Game.cpu.bucket);
        if (bucketHistory.length > HISTORY_LENGTH) {
            bucketHistory.shift();
        }
    }
}

/**
 * Calculates the average drain rate per tick based on history.
 * @returns {number} Average change in bucket per tick. Negative means drain.
 */
function getDrainRate() {
    if (bucketHistory.length < 2) return 0;

    let totalDrain = 0;
    for (let i = 1; i < bucketHistory.length; i++) {
        totalDrain += (bucketHistory[i] - bucketHistory[i - 1]);
    }

    return totalDrain / (bucketHistory.length - 1);
}

/**
 * Estimates the CPU bucket value in the near future.
 * @param {number} ticksAhead - The number of ticks in the future to forecast.
 * @returns {number} The forecasted CPU bucket.
 */
function getForecastedBucket(ticksAhead) {
    if (bucketHistory.length === 0) {
        if (typeof Game !== 'undefined' && Game.cpu && Game.cpu.bucket !== undefined) {
            return Game.cpu.bucket;
        }
        return 10000;
    }

    const currentBucket = bucketHistory[bucketHistory.length - 1];
    const drainRate = getDrainRate();

    const forecasted = currentBucket + (drainRate * ticksAhead);

    return Math.max(0, Math.min(10000, forecasted));
}

/**
 * Determines whether austerity measures should be preemptively triggered.
 * Checks if the bucket will fall below the threshold within a short window,
 * or if the drain rate exceeds a critical limit.
 * @returns {boolean} True if austerity should be triggered.
 */
function shouldTriggerAusterity() {
    if (bucketHistory.length < 5) return false; // Need enough data

    const currentBucket = bucketHistory[bucketHistory.length - 1];
    if (currentBucket < AUSTERITY_THRESHOLD) return true; // Already below threshold

    const drainRate = getDrainRate();

    // If we're draining fast and will hit threshold soon (e.g. 10 ticks)
    if (drainRate < DRAIN_RATE_THRESHOLD) {
        const forecasted10Ticks = getForecastedBucket(10);
        if (forecasted10Ticks < AUSTERITY_THRESHOLD) {
            return true;
        }
    }

    return false;
}

/**
 * Resets the forecaster state (useful for testing or global resets).
 */
function reset() {
    bucketHistory = [];
}

module.exports = {
    update,
    getForecastedBucket,
    shouldTriggerAusterity,
    reset,
    getDrainRate
};
