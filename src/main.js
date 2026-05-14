const { CacheRegistry } = require('./os/cache');
const globalState = require('./state/globalState');
const discoveryManager = require('./state/discoveryManager');
const stateScanner = require('./state/stateScanner');
const colonyManager = require('./colonies/colonyManager');
const operationsManager = require('./operations/operationsManager'); // High-level orchestrator
const trafficManager = require('./traffic/trafficManager');

module.exports.loop = function () {
    // Rehydrate global state
    globalState.rehydrate();

    // Initialize OS cache
    if (!global.Cache) {
        CacheRegistry.init();
    }

    // Phase 1: Discovery Manager (Raw Engine API execution & global.State Bootstrapping)
    try {
        if (discoveryManager) discoveryManager();
    } catch (e) {
        console.log(`[Phase 1 Error] Discovery Manager: ${e.stack}`);
        return; // Fatal OS crash
    }

    // Cascading CPU Throttling based on Game.cpu.bucket
    let skipState = false;
    let skipColonies = false;
    let skipOperations = false;

    switch (true) {
        case Game.cpu.bucket < 100:
            skipState = true;
            // fallthrough
        case Game.cpu.bucket < 500:
            skipColonies = true;
            // fallthrough
        case Game.cpu.bucket < 2000:
            skipOperations = true;
            // fallthrough
        default:
            break;
    }

    // Phase 2: State Scanner (Event-driven map updaters)
    if (!skipState) {
        try {
            if (stateScanner) stateScanner();
        } catch (e) {
            console.log(`[Phase 2 Error] Global State Scanner: ${e.stack}`);
        }
    }

    // Phase 3: Colonies
    if (!skipColonies) {
        try {
            if (colonyManager) colonyManager();
        } catch (e) {
            console.log(`[Phase 3 Error] Colonies: ${e.stack}`);
        }
    }

    // Phase 4: Operations Orchestration Module
    if (!skipOperations) {
        try {
            if (operationsManager) operationsManager();
        } catch (e) {
            console.log(`[Phase 4 Error] Operations: ${e.stack}`);
        }
    }

    // Phase 5: Traffic Control
    try {
        if (trafficManager && trafficManager.run) trafficManager.run();
    } catch (e) {
        console.log(`[Phase 5 Error] Traffic Control: ${e.stack}`);
    }

    // Phase 6: Intents & Sleep
    try {
        if (trafficManager && trafficManager.executeIntents) {
            trafficManager.executeIntents();
        }
    } catch (e) {
        console.log(`[Phase 6 Error] Intents & Sleep: ${e.stack}`);
    }
};
