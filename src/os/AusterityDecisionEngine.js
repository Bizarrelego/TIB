/**
 * Decision engine for determining the required CPU austerity level.
 * Evaluates current bucket, forecast, and drain rate against configurable thresholds.
 * @module os/AusterityDecisionEngine
 */

/**
 * @typedef {string} AusterityLevel
 */

/**
 * Enum for austerity levels.
 * @readonly
 * @enum {AusterityLevel}
 */
const LEVELS = {
    NONE: 'NONE',
    MILD: 'MILD',
    MODERATE: 'MODERATE',
    SEVERE: 'SEVERE'
};

/**
 * Configuration for austerity thresholds.
 * @typedef {Object} AusterityConfig
 * @property {number} SEVERE_BUCKET - Absolute bucket threshold for severe mode.
 * @property {number} MODERATE_BUCKET - Absolute bucket threshold for moderate mode.
 * @property {number} MILD_BUCKET - Absolute bucket threshold for mild mode.
 * @property {number} SEVERE_DRAIN - Drain rate threshold for severe mode.
 * @property {number} MODERATE_DRAIN - Drain rate threshold for moderate mode.
 * @property {number} MILD_DRAIN - Drain rate threshold for mild mode.
 */

/**
 * Default threshold configuration for the decision engine.
 * @type {AusterityConfig}
 */
const CONFIG = {
    SEVERE_BUCKET: 500,
    MODERATE_BUCKET: 2000,
    MILD_BUCKET: 4000,
    SEVERE_DRAIN: -50,
    MODERATE_DRAIN: -20,
    MILD_DRAIN: -10
};

/**
 * Evaluates CPU metrics to determine the necessary austerity level.
 * @param {number} currentBucket - The current CPU bucket value.
 * @param {number} forecast - The forecasted CPU bucket value.
 * @param {number} averageCpuDrain - The average CPU bucket drain per tick.
 * @returns {AusterityLevel} The required austerity level.
 */
function shouldActivateAusterity(currentBucket, forecast, averageCpuDrain) {
    // Check for SEVERE conditions
    if (currentBucket <= CONFIG.SEVERE_BUCKET || forecast <= CONFIG.SEVERE_BUCKET) {
        return LEVELS.SEVERE;
    }

    if (currentBucket <= CONFIG.MODERATE_BUCKET || forecast <= CONFIG.MODERATE_BUCKET) {
        if (averageCpuDrain <= CONFIG.SEVERE_DRAIN) {
            return LEVELS.SEVERE;
        }
        return LEVELS.MODERATE;
    }

    if (currentBucket <= CONFIG.MILD_BUCKET || forecast <= CONFIG.MILD_BUCKET) {
        if (averageCpuDrain <= CONFIG.MODERATE_DRAIN) {
            return LEVELS.MODERATE;
        }
        return LEVELS.MILD;
    }

    // Proactive checks based strictly on aggressive drain
    if (averageCpuDrain <= CONFIG.SEVERE_DRAIN) {
        return LEVELS.MODERATE;
    }
    if (averageCpuDrain <= CONFIG.MODERATE_DRAIN) {
        return LEVELS.MILD;
    }

    return LEVELS.NONE;
}

module.exports = {
    LEVELS,
    CONFIG,
    shouldActivateAusterity
};
