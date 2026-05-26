/**
 * @file PreSpawnCalculator.js
 * @description Utility to calculate the optimal pre-spawn time for creeps.
 */

const CachedPathing = require('./CachedPathing');

/**
 * Calculates the exact Game.time tick a replacement creep should be queued for spawning.
 *
 * @param {Array<string>} creepBody - The body parts of the creep to be spawned.
 * @param {number|Object} pathLength - The distance from spawn to work location.
 *                                     Can be a number, or an object {startPos, endPos} to calculate via CachedPathing.
 * @returns {number} The Game.time at which the creep should be queued.
 */
function calculatePreSpawnTick(creepBody, pathLength) {
    let actualPathLength = 0;

    if (typeof pathLength === 'number') {
        actualPathLength = pathLength;
    } else if (pathLength && pathLength.startPos && pathLength.endPos) {
        actualPathLength = CachedPathing.getPathLength(pathLength.startPos, pathLength.endPos) || 0;
    }

    // Standard spawn time calculation (Note: spawnCreep dryRun does not return spawn time)
    const spawnTime = (creepBody && creepBody.length) ? creepBody.length * 3 : 0;

    const leadTime = spawnTime + actualPathLength;

    const CREEP_LIFE_TIME = 1500;

    // Fallback if Game.time is not defined (for tests)
    const currentTime = (typeof Game !== 'undefined' && Game.time) ? Game.time : 0;

    return currentTime + CREEP_LIFE_TIME - leadTime;
}

module.exports = {
    calculatePreSpawnTick
};
