/**
 * @file GlobalResetDetector.js
 * @description Explicitly detects VM resets (global resets) and triggers the necessary rehydration processes.
 */

const GlobalStateRehydrator = require('./GlobalStateRehydrator');
const OSInitializer = require('./OSInitializer');
const Logger = require('../utils/logger');
const GlobalStateSchemaValidator = require('../state/GlobalStateSchemaValidator');

class GlobalResetDetector {
    /**
     * Checks for a global reset condition. If detected, triggers state rehydration.
     */
    static detectAndHandleReset() {
        if (!global.hasRunThisTick) {
            global.hasRunThisTick = true;
            Logger.info('[GlobalResetDetector] VM Reset detected. Initiating global OS initialization and state rehydration...');
            OSInitializer.init();
            require('./OSOrchestrator').init(); // Initialize OS Orchestrator scheduler tasks
            GlobalStateRehydrator.rehydrateGlobalState();

            if (global.State) {
                GlobalStateSchemaValidator.validateGlobalState(global.State);
            }
        }
    }
}

module.exports = GlobalResetDetector;
