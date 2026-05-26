const Profiler = require('./utils/profiler');

const managersIntegration = Profiler.wrap('managersIntegration', require('./managers/index'));
const globalState = Profiler.wrap('globalState', require('./state/globalState'));
const resetRecovery = Profiler.wrap('resetRecovery', require('./os/resetRecovery'));

const OSOrchestrator = require('./os/OSOrchestrator');
const colonyManager = require('./colonies/colonyManager');
const operationsManager = require('./operations/operationsManager');
const trafficManager = require('./traffic/trafficManager');
const cpuThrottler = require('./os/cpuThrottler');

const { wrapManager } = require('./utils/ManagerErrorBoundary');
const Logger = require('./utils/logger');
const { executeManager } = require('./utils/errorHandler');


module.exports.loop = wrapManager(Profiler.wrap('main.loop', function () {

    if (!Memory.os_initialized && global.Cache) {
        global.Cache = undefined;
        global.State = undefined;
    }

    Logger.info(`--- Starting Tick ${Game.time} ---`);

    const executeWrapped = (name, fn) => {
        if (!fn) return;
        wrapManager(fn, name)();
    };

    executeWrapped('managersIntegration.init', () => {
        if (managersIntegration && typeof managersIntegration.init === 'function') {
            managersIntegration.init(globalState);
        }
    });

    let throttlerFlags = {};
    if (cpuThrottler && typeof cpuThrottler.run === 'function') {
        throttlerFlags = cpuThrottler.run() || {};
    }

    // Run the centralized 6-phase pipeline
    OSOrchestrator.runPhase1();
    OSOrchestrator.runPhase2(throttlerFlags);

    if (!throttlerFlags.skipColonies) {
        colonyManager.run();
    }

    if (!throttlerFlags.skipOperations) {
        operationsManager.run();
    }

    trafficManager.run();
    OSOrchestrator.runPhase6();

    // Profiler output
    executeManager('Profiler.report', () => Profiler.report());

    // Save caches state for reset recovery
    executeManager('resetRecovery.saveState', () => resetRecovery.saveState());
}), 'main.loop');
