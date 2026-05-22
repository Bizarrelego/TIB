const Profiler = require('./utils/profiler');
const GlobalResetDetector = require('./os/GlobalResetDetector');
const resetRecovery = Profiler.wrap('resetRecovery', require('./os/resetRecovery'));
const managerOrchestrator = Profiler.wrap('managerOrchestrator', require('./managers/managerOrchestrator')); // Standalone Managers
const Logger = require('./utils/logger');
const cpuBucketForecaster = Profiler.wrap('cpuBucketForecaster', require('./os/cpuBucketForecaster'));
const { executeManager } = require('./utils/errorHandler');
const { wrap } = require('./utils/ManagerExecutionWrapper');


module.exports.loop = Profiler.wrap('main.loop', function () {
    GlobalResetDetector.detectAndHandleReset();

    if (!Memory.os_initialized && global.Cache) {
        global.Cache = undefined;
        global.State = undefined;
    }

    Logger.info(`--- Starting Tick ${Game.time} ---`);

    // Tick-level utilities

    executeManager('managerOrchestrator.init', () => managerOrchestrator.init());

    const OSInitializer = require('./os/OSInitializer');
    const globalState = require('./state/globalState');
    const trafficManager = require('./traffic/trafficManager');
    const IntentManager = require('./os/IntentManager');

    const interShardMemoryManager = require('./os/interShardMemoryManager');

    // Phase 1: OS Init & Cache
    executeManager('OSInitializer.run', () => OSInitializer.run());

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

    // Phase 2: Global State Population
    executeManager('globalState.update', () => globalState.update());

    const roomHasher = require('./os/roomHasher');
    executeManager('roomHasher.generate', () => {
        if (global.State && global.State.rooms) {
            for (const roomName of global.State.rooms.keys()) {
                if (roomHasher && typeof roomHasher.generate === 'function') roomHasher.generate(roomName);
            }
        }
    });

    // Phase 3 & 4: Manager Orchestration (Colonies & Operations)
    wrap('managerOrchestrator.run', () => managerOrchestrator.run())();

    // Phase 5: Traffic Control
    executeManager('trafficManager.run', () => {
        if (trafficManager && typeof trafficManager.run === 'function') trafficManager.run();
    });

    // Phase 6: Intents & Sleep
    executeManager('trafficManager.executeIntents', () => {
        if (trafficManager && typeof trafficManager.executeIntents === 'function') trafficManager.executeIntents();
    });
    executeManager('IntentManager.fire', () => {
        if (global.State && global.State.intentManager && typeof global.State.intentManager.fire === 'function') {
            global.State.intentManager.fire();
        } else if (IntentManager && typeof IntentManager.fire === 'function') {
            IntentManager.fire();
        }
    });

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
