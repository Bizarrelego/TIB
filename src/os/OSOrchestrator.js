const GlobalResetDetector = require('./GlobalResetDetector');
const heapValidator = require('./heapValidator');
const SystemScheduler = require('./SystemScheduler');
const cpuBucketForecaster = require('./cpuBucketForecaster');
const AusterityManager = require('./AusterityManager');
const RawMemoryManager = require('./RawMemoryManager');
const interShardMemoryManager = require('./interShardMemoryManager');
const garbageCollector = require('./garbageCollector');
const roomHasher = require('./roomHasher');
const VirtualLedger = require('../utils/VirtualLedger');
const resetRecovery = require('./resetRecovery');
const eventLogRadar = require('./eventLogRadar');
const PipelineLock = require('./PipelineLock');
const AusterityTrigger = require('./AusterityTrigger');
const Logger = require('../utils/logger');
const OSInitializer = require('./OSInitializer');
const IntentManager = require('./IntentManager');

class OSOrchestrator {
    static init() {
        // Register periodic tasks with SystemScheduler
        // E.g., run garbage collection every 100 ticks
        SystemScheduler.register('garbageCollector', 100, () => {
            Logger.debug('Running scheduled garbage collection');
            garbageCollector();
        });
    }

    static runPhase1() {
        const { wrap } = require('../utils/ManagerExecutionWrapper');

        if (OSInitializer && typeof OSInitializer.init === 'function') {
            wrap('OSInitializer.init', () => OSInitializer.init())();
        }

        const { CacheRegistry } = require('./cache');
        if (CacheRegistry && typeof CacheRegistry.init === 'function') {
            wrap('CacheRegistry.init', () => CacheRegistry.init())();
        }

        if (heapValidator && typeof heapValidator.validate === 'function') {
            wrap('heapValidator.validate', () => heapValidator.validate())();
        }

        wrap('OSOrchestrator.run', () => {
            if (GlobalResetDetector && typeof GlobalResetDetector.detectAndHandleReset === 'function') {
                GlobalResetDetector.detectAndHandleReset();
            }

            if (VirtualLedger && typeof VirtualLedger.clear === 'function') VirtualLedger.clear();
            if (resetRecovery && typeof resetRecovery.check === 'function') resetRecovery.check();
            if (eventLogRadar && typeof eventLogRadar === 'function') eventLogRadar();
            if (PipelineLock && typeof PipelineLock.clear === 'function') PipelineLock.clear();
            if (AusterityTrigger && typeof AusterityTrigger.evaluateAndTriggerAusterity === 'function') AusterityTrigger.evaluateAndTriggerAusterity();
            if (cpuBucketForecaster && typeof cpuBucketForecaster.update === 'function') cpuBucketForecaster.update();
            if (AusterityManager && typeof AusterityManager.run === 'function') AusterityManager.run();
            if (RawMemoryManager && typeof RawMemoryManager.init === 'function') {
                try {
                    RawMemoryManager.init();
                } catch (e) {
                    Logger.error(`[OSOrchestrator] RawMemoryManager init failed: ${e.stack}`);
                }
            }
            if (interShardMemoryManager && typeof interShardMemoryManager._loadLocal === 'function') interShardMemoryManager._loadLocal();
        })();
    }

    static runPhase2(throttlerFlags = {}) {
        const { wrap } = require('../utils/ManagerExecutionWrapper');
        const GlobalStatePopulator = require('../state/GlobalStatePopulator');
        const stateScanner = require('../state/stateScanner');
        const globalState = require('../state/globalState');
        const discoveryManager = require('../state/discoveryManager');
        const roomEventManager = require('../managers/RoomEventManager');
        const EnergySourceTracker = require('../managers/EnergySourceTracker');

        if (!throttlerFlags.skipState) {
            if (GlobalStatePopulator && typeof GlobalStatePopulator.populate === 'function') {
                wrap('GlobalStatePopulator.populate', () => GlobalStatePopulator.populate(global.State))();
            }

            if (stateScanner && typeof stateScanner.scan === 'function') {
                wrap('stateScanner.scan', () => stateScanner.scan())();
            }

            if (globalState && typeof globalState.update === 'function') {
                wrap('globalState.update', () => globalState.update())();
            }

            wrap('OSOrchestrator.updateRoomHashes', () => OSOrchestrator.updateRoomHashes())();

            if (discoveryManager && typeof discoveryManager === 'function') {
                wrap('discoveryManager', () => discoveryManager())();
            }

            if (roomEventManager && typeof roomEventManager === 'function') {
                wrap('roomEventManager', () => roomEventManager())();
            }

            if (EnergySourceTracker && typeof EnergySourceTracker.run === 'function') {
                wrap('EnergySourceTracker.run', () => EnergySourceTracker.run())();
            }
        }
    }

    static runPhase6() {
        const { wrap } = require('../utils/ManagerExecutionWrapper');
        const trafficManager = require('../traffic/trafficManager');
        const VisualsManager = require('../managers/VisualsManager');
        const memoryProxy = require('./memoryProxy');

        if (trafficManager && typeof trafficManager.executeIntents === 'function') {
            wrap('trafficManager.executeIntents', () => trafficManager.executeIntents())();
        }

        if (global.State && global.State.intentManager) {
            if (typeof global.State.intentManager.fireIntents === 'function') {
                wrap('intentManager.fireIntents', () => global.State.intentManager.fireIntents())();
            } else if (typeof global.State.intentManager.fire === 'function') {
                wrap('intentManager.fire', () => global.State.intentManager.fire())();
            }
        } else if (IntentManager && typeof IntentManager.processIntents === 'function') {
            wrap('IntentManager.processIntents', () => IntentManager.processIntents())();
        }

        if (VisualsManager && typeof VisualsManager.run === 'function') {
            wrap('VisualsManager.run', () => VisualsManager.run())();
        }

        if (memoryProxy && typeof memoryProxy.serialize === 'function') {
            wrap('memoryProxy.serialize', () => memoryProxy.serialize())();
        }

        if (SystemScheduler && typeof SystemScheduler.run === 'function') {
            wrap('SystemScheduler.run', () => SystemScheduler.run())();
        }

        if (SystemScheduler && typeof SystemScheduler.sleepNonCriticalSystems === 'function') {
            wrap('SystemScheduler.sleepNonCriticalSystems', () => SystemScheduler.sleepNonCriticalSystems())();
        }
    }

    static updateRoomHashes() {
        if (!global.State || !global.State.rooms) return;

        if (!global.Cache) {
            global.Cache = new Map();
        }
        if (!global.Cache.has('roomHashes')) {
            global.Cache.set('roomHashes', new Map());
        }
        if (!global.Cache.has('costMatrices')) {
            global.Cache.set('costMatrices', new Map());
        }

        const roomHashes = global.Cache.get('roomHashes');
        const costMatrices = global.Cache.get('costMatrices');

        for (const roomName of global.State.rooms.keys()) {
            if (roomHasher && typeof roomHasher.generate === 'function') {
                const currentHash = roomHasher.generate(roomName);
                const previousHash = roomHashes.get(roomName);

                if (currentHash !== previousHash) {
                    // Hash changed, invalidate the cached cost matrix for this room
                    roomHashes.set(roomName, currentHash);
                    costMatrices.delete(roomName);
                    Logger.debug(`[OSOrchestrator] Room hash changed for ${roomName}. Invalidated CostMatrix.`);
                }
            }
        }
    }
}

module.exports = OSOrchestrator;
