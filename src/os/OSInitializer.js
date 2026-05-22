const { CacheRegistry } = require('./cache');
const resetRecovery = require('./resetRecovery');
const RawMemoryManager = require('./RawMemoryManager');
const heapValidator = require('./heapValidator');
const memoryProxy = require('./memoryProxy');
const globalState = require('../state/globalState');
const garbageCollector = require('./garbageCollector');
const Logger = require('../utils/logger');
const IntentManager = require('./IntentManager');
const VirtualLedger = require('../utils/VirtualLedger');
const eventBus = require('./eventBus');
const cpuBucketForecaster = require('./cpuBucketForecaster');
const SystemScheduler = require('./SystemScheduler');
const roomHasher = require('./roomHasher');
const eventLogRadar = require('./eventLogRadar');
const BucketGatedDT = require('./BucketGatedDT');
const PipelineLock = require('./PipelineLock');

class OSInitializer {
    static init() {
        Logger.debug('Phase 1: OS Init & Cache');

        if (!global.Cache) {
            Logger.info('Respawn detected or first execution. Invalidating cache.');
            global.Cache = new Map();
            globalState.clear();
            global.State = globalState;
            Memory.os_initialized = true;
            CacheRegistry.init();
        }

        if (memoryProxy && typeof memoryProxy.init === 'function') {
            memoryProxy.init();
        } else if (typeof memoryProxy === 'function') {
            memoryProxy();
        }

        try {
            RawMemoryManager.init();
        } catch (e) {
            Logger.error(`[Phase 1 Error] RawMemoryManager: ${e.stack}`);
        }

        if (eventBus && typeof eventBus.init === 'function') {
            eventBus.init();
        }

        if (cpuBucketForecaster && typeof cpuBucketForecaster.update === 'function') {
            cpuBucketForecaster.update();
        }

        globalState.rehydrate();

        if (!global.State) {
            global.State = new Map();
        }
        if (!global.State.intentManager) {
            global.State.intentManager = new IntentManager();
        }

        VirtualLedger.clear();
        garbageCollector();

        heapValidator.validate();

        if (resetRecovery && typeof resetRecovery.check === 'function') {
            resetRecovery.check();
        }

        if (eventLogRadar && typeof eventLogRadar === 'function') {
            eventLogRadar();
        }

        if (PipelineLock && typeof PipelineLock.clear === 'function') {
            PipelineLock.clear();
        }

        if (SystemScheduler && typeof SystemScheduler.run === 'function') {
            SystemScheduler.run();
        }
    }

    static run() {
        OSInitializer.init();
    }
}

module.exports = OSInitializer;
