const { CacheRegistry } = require('./os/cache');
const resetRecovery = require('./os/resetRecovery');
const RawMemoryManager = require('./os/RawMemoryManager');
const installMemoryProxy = require('./os/memoryProxy');
const globalState = require('./state/globalState');
const managersIntegration = require('./managers/index');
const managerOrchestrator = require('./managers/managerOrchestrator'); // Standalone Managers
const cpuThrottler = require('./os/cpuThrottler');
const trafficManager = require('./traffic/trafficManager');
const garbageCollector = require('./os/garbageCollector');
const Logger = require('./utils/logger');
const IntentManager = require('./os/IntentManager');
const VirtualLedger = require('./utils/VirtualLedger');
const RoomVisualsManager = require('./managers/RoomVisualsManager');

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
        global.State = new Map();
    }
    if (!global.State.intentManager) {
        global.State.intentManager = new IntentManager();
    }
    
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

    const throttlerFlags = cpuThrottler.run();

    // Execute Phase 2-6 through managerOrchestrator
    managerOrchestrator.runPhase(2, throttlerFlags);
    managerOrchestrator.runPhase(3, throttlerFlags);
    managerOrchestrator.runPhase(4, throttlerFlags);
    managerOrchestrator.runPhase(5, throttlerFlags);
    managerOrchestrator.runPhase(6, throttlerFlags);

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

    if (Game.cpu.bucket > 5000 && RoomVisualsManager && typeof RoomVisualsManager.run === 'function') {
        RoomVisualsManager.run();
    }

    // Save caches state for reset recovery
    resetRecovery.saveState();
};
