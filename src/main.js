const Profiler = require('./utils/profiler');
const GlobalStateRehydrator = require('./os/GlobalStateRehydrator');
const OSInitializer = require('./os/OSInitializer');
const resetRecovery = Profiler.wrap('resetRecovery', require('./os/resetRecovery'));
const managerOrchestrator = Profiler.wrap('managerOrchestrator', require('./managers/managerOrchestrator')); // Standalone Managers
const Logger = require('./utils/logger');
const { executeManager } = require('./utils/errorHandler');
const { wrapManager } = require('./utils/ManagerErrorBoundary');


module.exports.loop = Profiler.wrap('main.loop', function () {
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

    // Tick-level utilities

    executeManager('managerOrchestrator.init', () => managerOrchestrator.init());

    const trafficManager = require('./traffic/trafficManager');
    const interShardMemoryManager = require('./os/interShardMemoryManager');

    executeManager('trafficManager.setup', () => {
        if (trafficManager && typeof trafficManager.setup === 'function') {
            trafficManager.setup();
        }
    });

    executeManager('interShardMemoryManager._loadLocal', () => {
        if (interShardMemoryManager && typeof interShardMemoryManager._loadLocal === 'function') {
            interShardMemoryManager._loadLocal();
        }
    });

    wrapManager(() => managerOrchestrator.run(), 'managerOrchestrator')();

    // Save state back to RawMemory
    const memoryProxy = require('./os/memoryProxy');
    executeManager('memoryProxy.serialize', () => {
        if (memoryProxy && typeof memoryProxy.serialize === 'function') memoryProxy.serialize();
    });

    // Profiler output
    executeManager('Profiler.report', () => Profiler.report());

    // Save caches state for reset recovery
    executeManager('resetRecovery.saveState', () => resetRecovery.saveState());
});
