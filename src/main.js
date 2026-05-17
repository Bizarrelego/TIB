const { CacheRegistry } = require('./os/cache');
const resetRecovery = require('./os/resetRecovery');
const RawMemoryManager = require('./os/RawMemoryManager');
const installMemoryProxy = require('./os/memoryProxy');
const globalState = require('./state/globalState');
const managersIntegration = require('./managers/index');
const discoveryManager = require('./state/discoveryManager');
const stateScanner = require('./state/stateScanner');
const managerOrchestrator = require('./managers/managerOrchestrator'); // Standalone Managers
const eventLogRadar = require('./os/eventLogRadar');
const cpuThrottler = require('./os/cpuThrottler');
const trafficManager = require('./traffic/trafficManager');
const garbageCollector = require('./os/garbageCollector');
const Logger = require('./utils/logger');
const IntentManager = require('./os/IntentManager');
const VirtualLedger = require('./utils/VirtualLedger');

// Added Missing OS Components
const cpuBucketForecaster = require('./os/cpuBucketForecaster');
const eventBus = require('./os/eventBus');
const objectPool = require('./os/objectPool');
const PipelineLock = require('./os/PipelineLock');

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
    
    // Initialize required OS state pieces
    if (!global.State.eventBus) {
        global.State.eventBus = eventBus;
    }
    if (!global.State.objectPool) {
        global.State.objectPool = objectPool;
    }
    if (!global.State.pipelineLock) {
        global.State.pipelineLock = PipelineLock;
    }

    // CPU bucket forecast tick
    cpuBucketForecaster.update();

    // Clear Virtual Ledger
    VirtualLedger.clear();

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
    const throttlerFlags = cpuThrottler.run();

    if (!throttlerFlags.skipState) {
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
            if (globalState && globalState.scan) globalState.scan();
        } catch (e) {
            Logger.error(`[Phase 2 Error] Global State Scan: ${e.stack}`);
        }
    }
    
    managerOrchestrator.runPhase(2, throttlerFlags);

    Logger.debug('Phase 3: Colonies');
    managerOrchestrator.runPhase(3, throttlerFlags);

    Logger.debug('Phase 4: Running Operations');
    managerOrchestrator.runPhase(4, throttlerFlags);

    Logger.debug('Phase 5: Running Traffic Control');
    managerOrchestrator.runPhase(5, throttlerFlags);

    Logger.debug('Phase 6: Executing Intents & Sleep');
    managerOrchestrator.runPhase(6, throttlerFlags);

    // Profiler output
    const Profiler = require('./utils/profiler');
    Profiler.report();

    // Save caches state for reset recovery
    resetRecovery.saveState();
};
