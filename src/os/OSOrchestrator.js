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
const cpuThrottler = require('./cpuThrottler');
const { wrapManager } = require('../utils/ManagerErrorBoundary');

class OSOrchestrator {
    static init() {
        // Register periodic tasks with SystemScheduler
        // E.g., run garbage collection every 100 ticks
        SystemScheduler.register('garbageCollector', 100, () => {
            Logger.debug('Running scheduled garbage collection');
            garbageCollector();
        });
    }

    static run() {
        const executeWrapped = (name, fn) => {
            if (!fn) return;
            wrapManager(fn, name)();
        };

        // Phase 1: OS Init & Cache
        executeWrapped('OSOrchestrator.Phase1', () => {
            if (OSInitializer && typeof OSInitializer.init === 'function') {
                OSInitializer.init();
            }
            if (GlobalResetDetector && typeof GlobalResetDetector.detectAndHandleReset === 'function') {
                GlobalResetDetector.detectAndHandleReset();
            }

            // Legacy OS run tasks
            if (heapValidator && typeof heapValidator.validate === 'function') heapValidator.validate();
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
        });
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
