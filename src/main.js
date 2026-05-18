const resetRecovery = require('./os/resetRecovery');
const globalState = require('./state/globalState');
const managersIntegration = require('./managers/index');
const managerOrchestrator = require('./managers/managerOrchestrator'); // Standalone Managers
const cpuThrottler = require('./os/cpuThrottler');
const trafficManager = require('./traffic/trafficManager');
const Logger = require('./utils/logger');
const cpuBucketForecaster = require('./os/cpuBucketForecaster');
const OSInitializer = require('./os/OSInitializer');
const EnergySourceTracker = require('./managers/EnergySourceTracker');

module.exports.loop = function () {
    Logger.info(`--- Starting Tick ${Game.time} ---`);

    OSInitializer.init();

    // TrafficManager setup before intents are registered
    try {
        if (trafficManager && trafficManager.setup) trafficManager.setup();
    } catch (e) {
        Logger.error(`[Phase 1 Error] TrafficManager Setup: ${e.stack}`);
    }

    const throttlerFlags = cpuThrottler.run();

    // Initialize managers via integration layer
    managersIntegration.init(globalState);

    // Call EnergySourceTracker specifically as per prompt
    EnergySourceTracker.run();

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

    // Save caches state for reset recovery
    resetRecovery.saveState();

    // Tick-level utilities
    cpuBucketForecaster.update();
};
