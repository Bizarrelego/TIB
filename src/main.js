const installMemoryProxy = require('./os/memoryProxy');
const cacheInit = require('./os/cache');
const stateScanner = require('./state/stateScanner');
const colonyManager = require('./colonies/colonyManager');
const operationsManager = require('./operations/operationsManager');
const trafficManager = require('./traffic/trafficManager');

module.exports.loop = function () {
    // Phase 1: OS Init & Cache
    try {
        if (installMemoryProxy) installMemoryProxy();
        if (cacheInit) cacheInit();
        if (!global.State) {
            global.State = {};
            global.State.structuresByRoom = new Map();
            global.State.creepsByRoom = new Map();
            global.State.hostilesByRoom = new Map();
            global.State.logisticsByRoom = new Map();
        }

    } catch (e) {
        console.log(`[Phase 1 Error] OS Init: ${e.stack}`);
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

    // Phase 2: Global State
    if (!skipState) {
        try {
            if (stateScanner) stateScanner();
        } catch (e) {
            console.log(`[Phase 2 Error] Global State: ${e.stack}`);
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

    // Phase 4: Operations
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
        // Execute deferred intents and sleep idle creeps
        if (trafficManager && trafficManager.executeIntents) {
            trafficManager.executeIntents();
        }
    } catch (e) {
        console.log(`[Phase 6 Error] Intents & Sleep: ${e.stack}`);
    }
};
