/**
 * Module responsible for dynamically adjusting bot operations based on the current CPU bucket.
 * Implements cascading CPU throttling to maintain a stable CPU floor, and triggers pixel generation.
 * @module os/cpuThrottler
 */

const Logger = require('../utils/logger');
const cpuBucketForecaster = require('./cpuBucketForecaster');
const AusterityManager = require('./AusterityManager');

/**
 * @typedef {Object} ThrottlingConfig
 * @property {boolean} skipState - Indicates if state scanning should be skipped.
 * @property {boolean} skipColonies - Indicates if colonies phase should be skipped.
 * @property {boolean} skipManagers - Indicates if standalone managers phase should be skipped.
 * @property {boolean} skipOperations - Indicates if operations orchestration phase should be skipped.
 * @property {boolean} skipVisuals - Indicates if visuals phase should be skipped.
 */

let cachedConfig = null;
let cacheTick = -1;

/**
 * Runs the CPU throttler to determine which operations to skip based on the current CPU bucket.
 * Also generates a pixel if the bucket is full (10000).
 *
 * @returns {ThrottlingConfig} The throttling configuration dictating which phases to skip.
 */
function run() {
    if (typeof Game !== 'undefined' && Game.time === cacheTick && cachedConfig) {
        return cachedConfig;
    }

    let skipState = false;
    let skipColonies = false;
    let skipManagers = false;
    let skipOperations = false;
    let skipVisuals = false;

    // Ensure Game and Game.cpu are available (important for mock environments)
    if (typeof Game !== 'undefined' && Game.cpu) {
        // Update Bucket Forecaster
        try {
            cpuBucketForecaster.update();
        } catch (e) {
            Logger.error(`[CPU Throttler] Error updating forecaster: ${e.stack}`);
        }

        const currentBucket = Game.cpu.bucket;

        // Pixel Generation
        if (currentBucket === 10000 && typeof Game.cpu.generatePixel === 'function') {
            try {
                Game.cpu.generatePixel();
                Logger.info('Generated a pixel via Game.cpu.generatePixel()');
            } catch (e) {
                Logger.error(`[CPU Throttler] Error generating pixel: ${e.stack}`);
            }
        }

        // Cascading CPU Throttling based on currentBucket (before any pixel generation drop)
        let forceAusterity = false;
        try {
            forceAusterity = AusterityManager.isActive();
        } catch (e) {
            Logger.error(`[CPU Throttler] Error checking austerity: ${e.stack}`);
        }

        switch (true) {
            case currentBucket < 100:
                skipState = true;
                // fallthrough
            case currentBucket < 500 || forceAusterity:
                skipColonies = true;
                skipManagers = true;
                // fallthrough
            case currentBucket < 2000:
                skipOperations = true;
                // fallthrough
            case currentBucket < 5000:
                skipVisuals = true;
                // fallthrough
            default:
                break;
        }
    }

    const config = {
        skipState,
        skipColonies,
        skipManagers,
        skipOperations,
        skipVisuals
    };

    if (typeof Game !== 'undefined') {
        cacheTick = Game.time;
        cachedConfig = config;
    }

    return config;
}

module.exports = {
    run,
    throttle: run
};
