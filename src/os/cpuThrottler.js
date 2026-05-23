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
 */

/**
 * Runs the CPU throttler to determine which operations to skip based on the current CPU bucket.
 * Also generates a pixel if the bucket is full (10000).
 *
 * @returns {ThrottlingConfig} The throttling configuration dictating which phases to skip.
 */
function run() {
    let skipState = false;
    let skipColonies = false;
    let skipManagers = false;
    let skipOperations = false;

    // Ensure Game and Game.cpu are available (important for mock environments)
    if (typeof Game !== 'undefined' && Game.cpu) {
        // Update Bucket Forecaster
        try {
            cpuBucketForecaster.update();
        } catch (e) {
            Logger.error(`[CPU Throttler] Error updating forecaster: ${e.stack}`);
        }

        // Pixel Generation
        if (Game.cpu.bucket === 10000 && typeof Game.cpu.generatePixel === 'function') {
            try {
                Game.cpu.generatePixel();
                Logger.info('Generated a pixel via Game.cpu.generatePixel()');
            } catch (e) {
                Logger.error(`[CPU Throttler] Error generating pixel: ${e.stack}`);
            }
        }

        // Cascading CPU Throttling based on Game.cpu.bucket
        let forceAusterity = false;
        try {
            forceAusterity = AusterityManager.isActive();
        } catch (e) {
            Logger.error(`[CPU Throttler] Error checking austerity: ${e.stack}`);
        }

        switch (true) {
            case Game.cpu.bucket < 100:
                skipState = true;
                // fallthrough
            case Game.cpu.bucket < 500 || forceAusterity:
                skipColonies = true;
                skipManagers = true;
                // fallthrough
            case Game.cpu.bucket < 2000:
                skipOperations = true;
                // fallthrough
            default:
                break;
        }
    }

    return {
        skipState,
        skipColonies,
        skipManagers,
        skipOperations
    };
}

module.exports = {
    run,
    throttle: run
};
