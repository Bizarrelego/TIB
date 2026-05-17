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
const cpuThrottler = require('./os/cpuThrottler');
const trafficManager = require('./traffic/trafficManager');
const garbageCollector = require('./os/garbageCollector');
const Logger = require('./utils/logger');
const IntentManager = require('./os/IntentManager');

module.exports.loop = function () {
    Logger.info(`--- Starting Tick ${Game.time} ---`);

    Logger.debug('Phase 1: OS Init & Cache');

    // Install memory proxy to bind heap to Creep prototypes
    installMemoryProxy();

    // Initialize RawMemory segments
    try {
        RawMemoryManager.init();
    } catch (e) {
        Logger.error(`[Phase 1 Error] RawMemoryManager: ${e.stack}`);
    }

    // Rehydrate global state
    globalState.rehydrate();

    if (!global.State) {
        global.State = {};
    }
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
        Logger.error(`[Phase 1 Error] TrafficManager Setup: ${e.stack}`);
    }

    Logger.debug('Phase 2: Global State');

    // Phase 2: Discovery Manager (Raw Engine API execution & global.State Bootstrapping)
    try {
        if (discoveryManager) discoveryManager();
    } catch (e) {
        Logger.error(`[Phase 2 Error] Discovery Manager: ${e.stack}`);
        return; // Fatal OS crash
    }

    // Phase 2: State Scanner (Event-driven map updaters)
    const { skipState, skipColonies, skipManagers, skipOperations } = cpuThrottler.run();

    if (!skipState) {
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

        try {
            const energyRequestManager = globalState.getManager('EnergyRequestManager');
            if (energyRequestManager && energyRequestManager.handleSourceSleep) {
                energyRequestManager.handleSourceSleep();
            }
        } catch (e) {
            Logger.error(`[Phase 2 Error] EnergyRequestManager: ${e.stack}`);
        }
    }

    Logger.debug('Phase 3: Colonies');
    // Phase 3: Colonies
    if (!skipColonies) {
        try {
            if (colonyManager) colonyManager();
        } catch (e) {
            Logger.error(`[Phase 3 Error] Colonies: ${e.stack}`);
        }
    }

    if (!skipManagers) {
        try {
            if (managerOrchestrator && managerOrchestrator.run) managerOrchestrator.run();
        } catch (e) {
            Logger.error(`[Phase 3 Error] Managers: ${e.stack}`);
        }

        try {
            const RoleManager = require('./colonies/RoleManager');
            RoleManager.runAll();
        } catch (e) {
            Logger.error(`[Phase 3 Error] RoleManager: ${e.stack}`);
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
        Logger.error(`[Phase 6 Error] IntentManager: ${e.stack}`);
    }

    // Profiler output
    Profiler.report();

    // Save caches state for reset recovery
    resetRecovery.saveState();
};
