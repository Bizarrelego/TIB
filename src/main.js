const resetRecovery = require('./os/resetRecovery');
const globalState = require('./state/globalState');
const managersIntegration = require('./managers/index');
const managerOrchestrator = require('./managers/managerOrchestrator'); // Standalone Managers
const cpuThrottler = require('./os/cpuThrottler');
const trafficManager = require('./traffic/trafficManager');
const Logger = require('./utils/logger');
const cpuBucketForecaster = require('./os/cpuBucketForecaster');
const OSInitializer = require('./os/OSInitializer');
const { executeManager } = require('./utils/errorHandler');

module.exports.loop = function () {
    if (!Memory.os_installed && global.Cache) {
        global.Cache = undefined;
        global.State = undefined;
    }

    Logger.info(`--- Starting Tick ${Game.time} ---`);

    // Tick-level utilities
    executeManager('cpuBucketForecaster.update', () => cpuBucketForecaster.update());

    executeManager('OSInitializer', () => OSInitializer.init());

    // TrafficManager setup before intents are registered
    executeManager('trafficManager.setup', () => {
        if (trafficManager && trafficManager.setup) trafficManager.setup();
    });

    let throttlerFlags = {};
    executeManager('cpuThrottler.run', () => {
        throttlerFlags = cpuThrottler.run() || {};
    });

    // Initialize managers via integration layer
    executeManager('managersIntegration.init', () => managersIntegration.init(globalState));

    // Execute Phase 2-6 through managerOrchestrator
    managerOrchestrator.runPhase(2, throttlerFlags);
    managerOrchestrator.runPhase(3, throttlerFlags);
    managerOrchestrator.runPhase(4, throttlerFlags);
    managerOrchestrator.runPhase(5, throttlerFlags);
    managerOrchestrator.runPhase(6, throttlerFlags);

    // Profiler output
    const Profiler = require('./utils/profiler');

    // Profiler output
    executeManager('Profiler.report', () => Profiler.report());

    // Save caches state for reset recovery
    executeManager('resetRecovery.saveState', () => resetRecovery.saveState());
};
