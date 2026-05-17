/**
 * @file fatigueGating.js
 * @description Utility for checking creep fatigue to prevent further execution of tick logic and save CPU.
 */

/**
 * Checks if a creep is fatigued.
 * @param {Creep} creep - The creep to check.
 * @returns {boolean} True if the creep has fatigue greater than 0, otherwise false.
 */
function isFatigued(creep) {
    return creep.fatigue > 0;
}

module.exports = {
    isFatigued
};
