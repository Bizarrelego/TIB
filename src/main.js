const Profiler = require('./utils/profiler');
const GlobalStateRehydrator = require('./os/GlobalStateRehydrator');
const OSInitializer = require('./os/OSInitializer');
const resetRecovery = Profiler.wrap('resetRecovery', require('./os/resetRecovery'));
const managerOrchestrator = Profiler.wrap('managerOrchestrator', require('./managers/managerOrchestrator')); // Standalone Managers

// Phase Managers
const VisualsManager = Profiler.wrap('VisualsManager', require('./managers/VisualsManager'));
const globalState = Profiler.wrap('globalState', require('./state/globalState'));
const managersIntegration = Profiler.wrap('managersIntegration', require('./managers/index'));

const Logger = require('./utils/logger');
const { executeManager } = require('./utils/errorHandler');
const { wrapManager } = require('./utils/ManagerErrorBoundary');


module.exports.loop = wrapManager(Profiler.wrap('main.loop', function () {
    if (!global.hasRunThisTick) {
        global.hasRunThisTick = true;
        OSInitializer.init();
        GlobalStateRehydrator.rehydrateGlobalState();
    }

    if (!Memory.os_initialized && global.Cache) {
        global.Cache = undefined;
        global.State = undefined;
    }

    Logger.info(`--- Starting Tick ${Game.time} ---`);

    // Initialize the manager orchestrator
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

    // Run the 6-Phase Pipeline
    executeManager('managerOrchestrator.runPipeline', () => {
        if (managerOrchestrator.runPipeline) {
            managerOrchestrator.runPipeline();
        }
    });

    // Bucket-gated non-critical visual logic
    if (typeof Game !== 'undefined' && Game.cpu && Game.cpu.bucket > 5000 && VisualsManager && typeof VisualsManager.run === 'function') {
        executeWrapped('VisualsManager.run', () => VisualsManager.run());
    }

    // Profiler output
    executeManager('Profiler.report', () => Profiler.report());

    // Save caches state for reset recovery
    executeManager('resetRecovery.saveState', () => resetRecovery.saveState());
}), 'main.loop');
