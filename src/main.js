const Profiler = require('./utils/profiler');
const resetRecovery = Profiler.wrap('resetRecovery', require('./os/resetRecovery'));
const managerOrchestrator = Profiler.wrap('managerOrchestrator', require('./managers/managerOrchestrator')); // Standalone Managers
const Logger = require('./utils/logger');
const cpuBucketForecaster = Profiler.wrap('cpuBucketForecaster', require('./os/cpuBucketForecaster'));
const { executeManager } = require('./utils/errorHandler');


module.exports.loop = Profiler.wrap('main.loop', function () {
    if (!Memory.os_initialized && global.Cache) {
        global.Cache = undefined;
        global.State = undefined;
    }

    Logger.info(`--- Starting Tick ${Game.time} ---`);

    // Tick-level utilities

    managerOrchestrator.init();

    // The single orchestrator call that handles all 6 phases.
    managerOrchestrator.run();

    // Profiler output
    executeManager('Profiler.report', () => Profiler.report());

    // Save caches state for reset recovery
    executeManager('resetRecovery.saveState', () => resetRecovery.saveState());
});
