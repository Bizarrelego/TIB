/**
 * @file GlobalResetDetector.js
 * @description Explicitly detects VM resets (global resets) and triggers the necessary rehydration processes.
 */

const GlobalStateRehydrator = require('./GlobalStateRehydrator');
const Logger = require('../utils/logger');

class GlobalResetDetector {
    /**
     * Checks for a global reset condition. If detected, triggers state rehydration.
     */
    static detectAndHandleReset() {
        if (!global.hasRunThisTick) {
            global.hasRunThisTick = true;
            Logger.info('[GlobalResetDetector] VM Reset detected. Initiating global state rehydration...');
            GlobalStateRehydrator.rehydrateGlobalState();
        }
    }
}

module.exports = GlobalResetDetector;
