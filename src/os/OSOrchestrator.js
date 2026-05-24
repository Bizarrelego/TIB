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
        // Handle global resets
        GlobalResetDetector.detectAndHandleReset();

        // Perform heap validation early in the tick
        heapValidator.validate();

        // Clear sub-tick ledger
        if (VirtualLedger && typeof VirtualLedger.clear === 'function') {
            VirtualLedger.clear();
        }

        // Check reset recovery
        if (resetRecovery && typeof resetRecovery.check === 'function') {
            resetRecovery.check();
        }

        // Run event log radar
        if (eventLogRadar && typeof eventLogRadar === 'function') {
            eventLogRadar();
        }

        // Clear pipeline lock
        if (PipelineLock && typeof PipelineLock.clear === 'function') {
            PipelineLock.clear();
        }

        // Austerity trigger
        if (AusterityTrigger && typeof AusterityTrigger.evaluateAndTriggerAusterity === 'function') {
            AusterityTrigger.evaluateAndTriggerAusterity();
        }

        // Update CPU bucket forecaster
        if (cpuBucketForecaster && typeof cpuBucketForecaster.update === 'function') {
            cpuBucketForecaster.update();
        }

        // Run Austerity Manager to check bucket trajectory and set austerity mode
        if (AusterityManager && typeof AusterityManager.run === 'function') {
            AusterityManager.run();
        }

        // Initialize RawMemory segments and load intel for the current tick
        if (RawMemoryManager && typeof RawMemoryManager.init === 'function') {
            try {
                RawMemoryManager.init();
            } catch (e) {
                Logger.error(`[OSOrchestrator] RawMemoryManager init failed: ${e.stack}`);
            }
        }

        // Load inter-shard memory for the current tick
        if (interShardMemoryManager && typeof interShardMemoryManager._loadLocal === 'function') {
            interShardMemoryManager._loadLocal();
        }

        // Run the SystemScheduler to execute scheduled tasks
        if (SystemScheduler && typeof SystemScheduler.run === 'function') {
            SystemScheduler.run();
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
