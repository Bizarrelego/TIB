const installMemoryProxy = require('./os/memoryProxy');
const cacheInit = require('./os/cache');
const stateScanner = require('./state/stateScanner');
const colonyManager = require('./colonies/colonyManager');
const operationsManager = require('./operations/operationsManager');
const trafficManager = require('./traffic/trafficManager');
const TowerManager = require('./managers/TowerManager');

module.exports.loop = function () {
    // Cascading switch statement for hard CPU throttling based on Game.cpu.bucket
    let skipOperations = false;
    let skipColonies = false;
    let skipState = false;

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

    // Phase 1: OS Init & Cache
    try {
        installMemoryProxy();
        cacheInit();
    } catch (e) {
        console.log(`[Phase 1 Error] OS Init: ${e.stack}`);
    }

    // Phase 2: Global State
    if (!skipState) {
        try {
            stateScanner();
        } catch (e) {
            console.log(`[Phase 2 Error] Global State: ${e.stack}`);
        }
    }

    // Phase 3: Colonies
    if (!skipColonies) {
        try {
            colonyManager();
        } catch (e) {
            console.log(`[Phase 3 Error] Colonies: ${e.stack}`);
        }
    }

    // Phase 4: Operations
    if (!skipOperations) {
        try {
            operationsManager();
        } catch (e) {
            console.log(`[Phase 4 Error] Operations: ${e.stack}`);
        }
    }

    // Phase 5: Traffic Control
    try {
        trafficManager.run();
    } catch (e) {
        console.log(`[Phase 5 Error] Traffic Control: ${e.stack}`);
    }

    // Tower Manager Loop
    for (const room of Object.values(Game.rooms)) {
        if (room.controller && room.controller.my === true) {
            try {
                TowerManager.run(room);
            } catch (e) {
                console.log(`[TowerManager Loop Error] Room ${room.name}: ${e.stack}`);
            }
        }
    }

    // Phase 6: Intents & Sleep
    try {
        // Execute deferred intents and sleep idle creeps
    } catch (e) {
        console.log(`[Phase 6 Error] Intents & Sleep: ${e.stack}`);
    }
};
