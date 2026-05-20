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

        globalState.rehydrate();

        if (!global.State) {
            global.State = new Map();
        }
        if (!global.State.intentManager) {
            global.State.intentManager = new IntentManager();
        }

        VirtualLedger.clear();
        garbageCollector();

        resetRecovery.checkAndRecover();
        heapValidator.validate();
    }

    static run() {
        OSInitializer.init();
    }
}

module.exports = OSInitializer;
