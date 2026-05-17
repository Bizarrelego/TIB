const { CacheRegistry } = require('./os/cache');
const resetRecovery = require('./os/resetRecovery');
const RawMemoryManager = require('./os/RawMemoryManager');
const installMemoryProxy = require('./os/memoryProxy');
const globalState = require('./state/globalState');
const managersIntegration = require('./managers/index');
const discoveryManager = require('./state/discoveryManager');
const stateScanner = require('./state/stateScanner');
const colonyManager = require('./colonies/colonyManager');
const operationsManager = require('./operations/operationsManager'); // High-level orchestrator
const managerOrchestrator = require('./managers/managerOrchestrator'); // Standalone Managers
const eventLogRadar = require('./os/eventLogRadar');
const trafficManager = require('./traffic/trafficManager');
const movement = require('./utils/movement');
const garbageCollector = require('./os/garbageCollector');
const Logger = require('./utils/logger');
const IntentManager = require('./os/IntentManager');

module.exports.loop = function () {
    Logger.info(`--- Starting Tick ${Game.time} ---`);

    // Install memory proxy to bind heap to Creep prototypes
    installMemoryProxy();

    // Initialize RawMemory segments
    try {
        RawMemoryManager.init();
    } catch (e) {
        Logger.error(`[Phase 0 Error] RawMemoryManager: ${e.stack}`);
    }

    // Rehydrate global state
    globalState.rehydrate();

    if (!global.State.intentManager) {
        global.State.intentManager = new IntentManager();
    }

    // Run garbage collection for memory and intel
    garbageCollector();

    // Initialize managers via integration layer
    managersIntegration.init(globalState);

    // Initialize OS cache
    if (!global.Cache) {
        CacheRegistry.init();
    }

    // Attempt global reset recovery
    resetRecovery.checkAndRecover();

    // TrafficManager setup before intents are registered
    try {
        if (trafficManager && trafficManager.setup) trafficManager.setup();
    } catch (e) {
        Logger.error(`[Phase 0 Error] TrafficManager Setup: ${e.stack}`);
    }

    // Phase 1: Discovery Manager (Raw Engine API execution & global.State Bootstrapping)
    Logger.debug('Phase 1: Running Discovery Manager');
    try {
        if (discoveryManager) discoveryManager();
    } catch (e) {
        Logger.error(`[Phase 1 Error] Discovery Manager: ${e.stack}`);
        return; // Fatal OS crash
    }

    // Cascading CPU Throttling based on Game.cpu.bucket
    let skipState = false;
    let skipColonies = false;
    let skipManagers = false;
    let skipOperations = false;

    switch (true) {
        case Game.cpu.bucket < 100:
            skipState = true;
            // fallthrough
        case Game.cpu.bucket < 500:
            skipColonies = true;
            skipManagers = true;
            // fallthrough
        case Game.cpu.bucket < 2000:
            skipOperations = true;
            // fallthrough
        default:
            break;
    }

    // Phase 2: State Scanner (Event-driven map updaters)
    if (!skipState) {
        Logger.debug('Phase 2: Running State Scanner');
        try {
            if (eventLogRadar) eventLogRadar();
        } catch (e) {
            Logger.error(`[Phase 2 Error] Event Log Radar: ${e.stack}`);
        }

        try {
            if (stateScanner) stateScanner();
        } catch (e) {
            Logger.error(`[Phase 2 Error] Global State Scanner: ${e.stack}`);
        }
    }

    // Phase 2.5: Execution Gates
    Logger.debug('Phase 2.5: Running Execution Gates');
    try {
        const energyRequestManager = globalState.getManager('EnergyRequestManager');
        if (energyRequestManager && energyRequestManager.handleSourceSleep) {
            energyRequestManager.handleSourceSleep();
        }
    } catch (e) {
        Logger.error(`[Phase 2.5 Error] EnergyRequestManager: ${e.stack}`);
    }

    // Phase 3: Colonies
    if (!skipColonies) {
        Logger.debug('Phase 3: Running Colonies');
        try {
            if (colonyManager) colonyManager();
        } catch (e) {
            Logger.error(`[Phase 3 Error] Colonies: ${e.stack}`);
        }
    }

    // Phase 3.5: Standalone Managers
    if (!skipManagers) {
        Logger.debug('Phase 3.5: Running Standalone Managers');
        try {
            if (managerOrchestrator && managerOrchestrator.run) managerOrchestrator.run();
        } catch (e) {
            Logger.error(`[Phase 3.5 Error] Managers: ${e.stack}`);
        }
    }

    // Phase 4: Operations Orchestration Module
    if (!skipOperations) {
        Logger.debug('Phase 4: Running Operations');
        try {
            if (operationsManager) operationsManager();
        } catch (e) {
            Logger.error(`[Phase 4 Error] Operations: ${e.stack}`);
        }
    }

    // Phase 5: Traffic Control
    Logger.debug('Phase 5: Running Traffic Control');
    try {
        if (trafficManager && trafficManager.run) trafficManager.run();
    } catch (e) {
        Logger.error(`[Phase 5 Error] Traffic Control: ${e.stack}`);
    }

    // Phase 6: Intents & Sleep
    Logger.debug('Phase 6: Executing Intents & Sleep');
    try {
        if (trafficManager && trafficManager.executeIntents) {
            trafficManager.executeIntents();
        }
    } catch (e) {
        Logger.error(`[Phase 6 Error] Intents & Sleep: ${e.stack}`);
    }

    // Profiler output
    const Profiler = require('./utils/profiler');
    try {
        if (global.State && global.State.intentManager) {
            global.State.intentManager.executeIntents();
        }
    } catch (e) {
        Logger.error(`[Phase 7 Error] IntentManager: ${e.stack}`);
    }

    // Profiler output
    Profiler.report();

    // Save caches state for reset recovery
    resetRecovery.saveState();
};
