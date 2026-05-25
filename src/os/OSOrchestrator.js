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
const GlobalStatePopulator = require('../state/GlobalStatePopulator');
const colonyManager = require('../colonies/colonyManager');
const operationsManager = require('../operations/operationsManager');
const trafficManager = require('../traffic/trafficManager');
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
        let throttlerFlags = {};
        if (cpuThrottler && typeof cpuThrottler.run === 'function') {
            throttlerFlags = cpuThrottler.run() || {};
        }

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

        // Phase 2: Global State
        if (!throttlerFlags.skipState) {
            executeWrapped('OSOrchestrator.Phase2', () => {
                if (GlobalStatePopulator && typeof GlobalStatePopulator.populate === 'function') {
                    // It uses global.State if we pass state, but GlobalStatePopulator usually manages it.
                    GlobalStatePopulator.populate(global.State);
                }

                // Fallback for legacy state scanner logic that populated state if GlobalStatePopulator doesn't.
                // It was handled in Phase 2.
                const stateScanner = require('../state/stateScanner');
                if (stateScanner && typeof stateScanner.scan === 'function') {
                    stateScanner.scan();
                }

                const globalState = require('../state/globalState');
                if (globalState && typeof globalState.update === 'function') {
                    globalState.update();
                }

                OSOrchestrator.updateRoomHashes();

                const discoveryManager = require('../state/discoveryManager');
                if (discoveryManager && typeof discoveryManager === 'function') discoveryManager();

                const roomEventManager = require('../managers/RoomEventManager');
                if (roomEventManager && typeof roomEventManager === 'function') roomEventManager();

                const EnergySourceTracker = require('../managers/EnergySourceTracker');
                if (EnergySourceTracker && typeof EnergySourceTracker.run === 'function') EnergySourceTracker.run();
            });
        }

        // Phase 3: Colonies
        if (!throttlerFlags.skipColonies) {
            executeWrapped('OSOrchestrator.Phase3', () => {
                if (colonyManager && typeof colonyManager.run === 'function') {
                    colonyManager.run();
                }

                // Incorporating remaining legacy manager logic that was part of phase 3
                const defconManager = require('../colonies/defconManager');
                if (global.State && global.State.rooms && defconManager && typeof defconManager.run === 'function') {
                    for (const room of global.State.rooms.values()) defconManager.run(room);
                }

                // Call runRoomManagers logic from managerOrchestrator
                const { runRoomManagers } = require('../managers/managerOrchestrator');
                if (typeof runRoomManagers === 'function') {
                    runRoomManagers();
                }
            });
        }

        // Phase 4: Operations
        if (!throttlerFlags.skipOperations) {
            executeWrapped('OSOrchestrator.Phase4', () => {
                if (operationsManager && typeof operationsManager.run === 'function') {
                    operationsManager.run();
                }
            });
        }

        // Phase 5: Traffic Control
        executeWrapped('OSOrchestrator.Phase5', () => {
            if (trafficManager && typeof trafficManager.setup === 'function') {
                trafficManager.setup();
            }
            if (trafficManager && typeof trafficManager.run === 'function') {
                trafficManager.run();
            }
        });

        // Phase 6: Intents & Sleep
        executeWrapped('OSOrchestrator.Phase6', () => {
            if (trafficManager && typeof trafficManager.executeIntents === 'function') {
                trafficManager.executeIntents();
            }

            if (global.State && global.State.intentManager) {
                if (typeof global.State.intentManager.fireIntents === 'function') {
                    global.State.intentManager.fireIntents();
                } else if (typeof global.State.intentManager.fire === 'function') {
                    global.State.intentManager.fire();
                }
            } else if (IntentManager && typeof IntentManager.processIntents === 'function') {
                IntentManager.processIntents();
            }

            const memoryProxy = require('./memoryProxy');
            if (memoryProxy && typeof memoryProxy.serialize === 'function') {
                memoryProxy.serialize();
            }

            if (SystemScheduler && typeof SystemScheduler.run === 'function') {
                SystemScheduler.run();
            }

            if (SystemScheduler && typeof SystemScheduler.sleepNonCriticalSystems === 'function') {
                SystemScheduler.sleepNonCriticalSystems();
            }
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
