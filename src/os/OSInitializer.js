const { CacheRegistry } = require('./cache');
const memoryProxy = require('./memoryProxy');
const globalState = require('../state/globalState');
const Logger = require('../utils/logger');
const IntentManager = require('./IntentManager');
const eventBus = require('./eventBus');
const GlobalStateSchemaValidator = require('../state/GlobalStateSchema');
const DistanceTransformInterface = require('../algorithms/wasm/distanceTransformInterface');
const MinCutInterface = require('../algorithms/wasm/minCutInterface');
const objectPool = require('./objectPool');
const interShardSync = require('./interShardSync');

class OSInitializer {
    static init() {
        Logger.debug('OS Init & Cache');

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

        if (eventBus && typeof eventBus.init === 'function') {
            eventBus.init();
        }

        if (objectPool && typeof objectPool.init === 'function') {
            objectPool.init();
        }

        if (interShardSync && typeof interShardSync.init === 'function') {
            interShardSync.init();
        }

        if (!global.State) {
            global.State = new Map();
        }
        if (!global.State.intentManager) {
            global.State.intentManager = new IntentManager();
        }

        GlobalStateSchemaValidator.validateState(global.State);

        // Initialize WASM modules asynchronously (fire and forget)
        DistanceTransformInterface.init().catch(e => Logger.error(`[OSInitializer] Failed to init DistanceTransform WASM: ${e.stack || e}`));
        MinCutInterface.init().catch(e => Logger.error(`[OSInitializer] Failed to init MinCut WASM: ${e.stack || e}`));
    }

    static run() {
        OSInitializer.init();
    }
}

module.exports = OSInitializer;
