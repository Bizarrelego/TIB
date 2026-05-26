const Profiler = require('./utils/profiler');
const managerOrchestrator = Profiler.wrap('managerOrchestrator', require('./managers/managerOrchestrator')); // Standalone Managers

const managersIntegration = Profiler.wrap('managersIntegration', require('./managers/index'));
const globalState = Profiler.wrap('globalState', require('./state/globalState'));
const resetRecovery = Profiler.wrap('resetRecovery', require('./os/resetRecovery'));

const { wrapManager } = require('./utils/ManagerErrorBoundary');
const Logger = require('./utils/logger');
const { executeManager } = require('./utils/errorHandler');


module.exports.loop = wrapManager(Profiler.wrap('main.loop', function () {

    if (!Memory.os_initialized && global.Cache) {
        global.Cache = undefined;
        global.State = undefined;
    }

    Logger.info(`--- Starting Tick ${Game.time} ---`);

    // Tick-level utilities
    executeManager('managerOrchestrator.init', () => managerOrchestrator.init());

    const executeWrapped = (name, fn) => {
        if (!fn) return;
        wrapManager(fn, name)();
    };

    executeWrapped('managersIntegration.init', () => {
        if (managersIntegration && typeof managersIntegration.init === 'function') {
            managersIntegration.init(globalState);
        }
    });

    // Run the centralized 6-phase pipeline
    managerOrchestrator.run();

    // Profiler output
    executeManager('Profiler.report', () => Profiler.report());

    // Save caches state for reset recovery
    executeManager('resetRecovery.saveState', () => resetRecovery.saveState());
}), 'main.loop');
