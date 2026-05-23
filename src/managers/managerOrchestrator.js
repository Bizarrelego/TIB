const Profiler = require('../utils/profiler');
const globalState = Profiler.wrap('globalState', require('../state/globalState'));
const Logger = require('../utils/logger');
const { executeManager } = require('../utils/errorHandler');
const defconManager = Profiler.wrap('defconManager', require('../colonies/defconManager'));
const VirtualLedger = require('../utils/VirtualLedger');
const { wrapModuleFunctions } = require('../utils/moduleWrapper');
const errorHandler = require('../utils/errorHandler');

// Phase Managers
const discoveryManager = Profiler.wrap('discoveryManager', require('../state/discoveryManager'));
const OSInitializer = Profiler.wrap('OSInitializer', require('../os/OSInitializer'));
const stateScanner = Profiler.wrap('stateScanner', require('../state/stateScanner'));
const colonyManager = Profiler.wrap('colonyManager', require('../colonies/colonyManager'));
const spawnManager = Profiler.wrap('spawnManager', require('../colonies/spawnManager'));
const SpawnLedger = require('../colonies/spawnLedger');
const BoostManager = Profiler.wrap('BoostManager', require('./BoostManager'));
const VisualsManager = Profiler.wrap('VisualsManager', require('./VisualsManager'));
const planner = Profiler.wrap('planner', require('../colonies/planner'));
const { wrap } = require('../utils/ManagerExecutionWrapper');
const { wrapManager } = require('../utils/ManagerErrorBoundary');

const RoleManager = Profiler.wrap('RoleManager', require('../colonies/RoleManager'));
const operationsManager = Profiler.wrap('operationsManager', require('../operations/operationsManager'));
const roomEventManager = Profiler.wrap('RoomEventManager', require('./RoomEventManager'));
const EnergySourceTracker = Profiler.wrap('EnergySourceTracker', require('./EnergySourceTracker'));

const trafficManager = require('../traffic/trafficManager');
const IntentManager = require('../os/IntentManager');
const SystemScheduler = require('../os/SystemScheduler');
const roomHasher = require('../os/roomHasher');
const GlobalResetDetector = require('../os/GlobalResetDetector');
const interShardMemoryManager = require('../os/interShardMemoryManager');
const memoryProxy = require('../os/memoryProxy');

/**
 * @file managerOrchestrator.js
 * @description Centralized execution module for standalone room managers.
 * Implements CPU throttling and error isolation to safely execute manager logic
 * without blocking the main execution loop.
 */

/**
 * Orchestrates the execution of standalone managers per room.
 * Retrieves rooms safely from global.State.rooms to adhere to the Zero Native Polling constraint.
 * Skips execution entirely if the CPU bucket falls below 500.
 *
 * @returns {void}
 */
function runRoomManagers() {
    // Zero Native Polling: rely on global.State for room objects if available.
    // Ensure discoveryManager has populated global.State.rooms
    if (!global.State || !global.State.rooms) return;

    for (const roomName of global.State.rooms.keys()) {
        const room = global.State.rooms.get(roomName);

        // Only run managers in controlled rooms
        if (!room || !room.controller || !room.controller.my) continue;

        // Top-Down Emergency Override
        const roomCreeps = global.State.creepsByRoom.get(room.name);
        if (roomCreeps) {
            const haulers = roomCreeps.get('hauler') || [];
            const domHaulers = roomCreeps.get('domesticHauler') || [];
            const harvesters = roomCreeps.get('harvester') || [];
            
            // If room starvation and no haulers exist, dynamically overwrite harvesters to domesticHauler
            if (room.energyAvailable < 300 && haulers.length === 0 && domHaulers.length === 0 && harvesters.length > 0) {
                const overridden = [];
                for (let i = harvesters.length - 1; i >= 0; i--) {
                    const h = harvesters[i];
                    if (h.store.getUsedCapacity() > 0) {
                        h.heap.state = 'transfer';
                    } else {
                        h.heap.state = 'pickup';
                    }
                    overridden.push(h);
                    harvesters.splice(i, 1);
                }
                roomCreeps.set('domesticHauler', domHaulers.concat(overridden));
            }
        }

        // Managers configuration for tick-slicing
        const managersConfig = [
            { name: 'NukeEvacuationManager', slice: 1 },
            { name: 'RampartDefenseManager', slice: 1 },
            { name: 'TowerManager', slice: 1 },
            { name: 'ConstructionManager', slice: 1 },
            { name: 'workerManager', slice: 1 },
            { name: 'LinkManager', slice: 1 },
            { name: 'UpgraderManager', slice: 1 },
            { name: 'StorageManager', slice: 1 },
            { name: 'LogisticsManager', slice: 1 },
            { name: 'LabManager', slice: 5 },
            { name: 'RemoteEconomyManager', slice: 5 },
            { name: 'MarketManager', slice: 10 },
            { name: 'TerminalManager', slice: 10 },
            { name: 'QuadSquadManager', slice: 1 }
        ];

        if (room.controller.level < 6) {
            const prune = ['NukeEvacuationManager', 'TerminalManager', 'LabManager'];
            for (let i = managersConfig.length - 1; i >= 0; i--) {
                if (prune.includes(managersConfig[i].name)) {
                    managersConfig.splice(i, 1);
                }
            }
        }

        const registeredManagers = Object.keys(require('./index').managers);
        for (const name of registeredManagers) {
            // Exclude global or static managers from per-room execution
            if (['PreSpawnManager', 'SpawnQueueManager', 'RoomEventManager', 'AllianceIntelManager', 'CombatManager', 'EnergyRequestManager', 'VisualsManager'].includes(name)) {
                continue;
            }
            if (!managersConfig.find(c => c.name === name)) {
                managersConfig.push({ name, slice: 1 });
            }
        }

        // Tick Slicer execution gating
        let TickSlicer;
        try {
            TickSlicer = require('../os/TickSlicer');
        } catch (e) {
            // TickSlicer not yet implemented, proceed with default logic
        }

        // Initialize Process Table in Heap
        if (!global.Cache) {
            const { CacheRegistry } = require('../os/cache');
            CacheRegistry.init();
        }
        if (!global.Cache.has('processes')) global.Cache.set('processes', new Map());

        for (const config of managersConfig) {
            let processId = `${room.name}_${config.name}`;
            let processObj = global.Cache.get('processes').get(processId);

            // TickSlicer integration overrides legacy slice logic
            if (TickSlicer && typeof TickSlicer.shouldRun === 'function') {
                if (!TickSlicer.shouldRun(config.name, room.name)) continue;
            } else {
                // Process Scheduler (OS Sleep/Wake)
                if (processObj && processObj.wakeTick && Game.time < processObj.wakeTick) {
                    continue; // Process is asleep, drop idle execution cost to 0
                }

                // Fallback to legacy modulo tick-slicing if wakeTick is not set
                if ((!processObj || !processObj.wakeTick) && Game.time % config.slice !== 0) continue;
            }

            let manager = globalState.getManager(config.name);
            if (manager && typeof manager.run === 'function') {
                // Ensure process object exists for the manager to modify its own wakeTick
                if (!processObj) {
                    processObj = { id: processId };
                    global.Cache.get('processes').set(processId, processObj);
                }
                // Ensure the manager's methods are wrapped by the error handler
                if (!manager.__errorWrapped) {
                    manager = wrapModuleFunctions(manager, (funcName, originalFunc, ...args) => {
                        return executeManager(`${config.name}.${funcName}`, originalFunc, ...args);
                    });
                    manager.__errorWrapped = true;
                    // Note: In globalState, it's stored by reference, but we assign it locally too
                }

                // Ensure the manager's methods are wrapped by the profiler
                if (!manager.__profilerWrapped) {
                    manager = Profiler.wrap(config.name, manager);
                    manager.__profilerWrapped = true;
                }

                Logger.debug(`Running manager ${config.name} in room ${room.name}`);
                const profilerEnabled = global.PROFILER_ENABLED || (typeof Memory !== 'undefined' && Memory.PROFILER_ENABLED);
                const cpuAvailable = typeof Game !== 'undefined' && Game.cpu && typeof Game.cpu.getUsed === 'function';
                let startCpu;
                if (profilerEnabled) {
                    startCpu = cpuAvailable ? Game.cpu.getUsed() : Date.now();
                }

                // Call directly since wrapModuleFunctions provides the error boundary now
                manager.run(room, processObj);

                if (profilerEnabled) {
                    const endCpu = cpuAvailable ? Game.cpu.getUsed() : Date.now();
                    Profiler.record(config.name, endCpu - startCpu);
                }
            }
        }
    }
}

/**
 * Runs a specific execution phase and manages error boundaries.
 *
 * @param {number} phase - The execution phase to run (2-6).
 * @param {Object} throttlerFlags - CPU Throttler output.
 */

const registeredTopLevelManagers = new Map();

function init() {
    registeredTopLevelManagers.set('OSInitializer', typeof OSInitializer !== 'undefined' ? OSInitializer : Profiler.wrap('OSInitializer', require('../os/OSInitializer')));
    registeredTopLevelManagers.set('globalState', typeof globalState !== 'undefined' ? globalState : Profiler.wrap('globalState', require('../state/globalState')));
    registeredTopLevelManagers.set('colonyManager', typeof colonyManager !== 'undefined' ? colonyManager : Profiler.wrap('colonyManager', require('../colonies/colonyManager')));
    registeredTopLevelManagers.set('operationsManager', typeof operationsManager !== 'undefined' ? operationsManager : Profiler.wrap('operationsManager', require('../operations/operationsManager')));

    let loadedRCLProgressionManager = require('../colonies/RCLProgressionManager');
    loadedRCLProgressionManager = Profiler.wrap('RCLProgressionManager', loadedRCLProgressionManager);
    registeredTopLevelManagers.set('RCLProgressionManager', loadedRCLProgressionManager);

    let loadedAssignmentUtility = require('../utils/AssignmentUtility');
    loadedAssignmentUtility = Profiler.wrap('AssignmentUtility', loadedAssignmentUtility);
    registeredTopLevelManagers.set('AssignmentUtility', loadedAssignmentUtility);
    let loadedPowerSpawnManager = require('./PowerSpawnManager');
    loadedPowerSpawnManager = Profiler.wrap('PowerSpawnManager', loadedPowerSpawnManager);
    registeredTopLevelManagers.set('PowerSpawnManager', loadedPowerSpawnManager);

    let loadedCreepAssignmentManager = require('./CreepAssignmentManager');
    loadedCreepAssignmentManager = Profiler.wrap('CreepAssignmentManager', loadedCreepAssignmentManager);
    registeredTopLevelManagers.set('CreepAssignmentManager', loadedCreepAssignmentManager);

}

const cpuThrottler = Profiler.wrap('cpuThrottler', require('../os/cpuThrottler'));
const cpuBucketForecaster = require('../os/cpuBucketForecaster');
const managersIntegration = Profiler.wrap('managersIntegration', require('./index'));
const { wrap } = require('../utils/ManagerExecutionWrapper');

// Required modules for phases (Top level to avoid tick-time synchronous requires)
const heapValidator = require('../os/heapValidator');
const GlobalResetDetector = require('../os/GlobalResetDetector');
const GlobalStateRehydrator = require('../os/GlobalStateRehydrator');
const OSInitializer = require('../os/OSInitializer');
const interShardMemoryManager = require('../os/interShardMemoryManager');
const stateScanner = require('../state/stateScanner');
const globalState = require('../state/globalState');
const trafficManager = require('../traffic/trafficManager');
const IntentManager = require('../os/IntentManager');
const memoryProxy = require('../os/memoryProxy');
const SystemScheduler = require('../os/SystemScheduler');
const roomHasher = require('../os/roomHasher');
const discoveryManager = require('../state/discoveryManager');
const roomEventManager = require('./RoomEventManager');
const EnergySourceTracker = require('./EnergySourceTracker');
const VirtualLedger = require('../utils/VirtualLedger');
const defconManager = require('../colonies/defconManager');
const spawnManager = require('../colonies/spawnManager');
const SpawnLedger = require('../colonies/spawnLedger');
const BoostManager = require('./BoostManager');
const planner = require('../colonies/planner');
const RoleManager = require('../colonies/RoleManager');
const AllianceIntelManager = require('./AllianceIntelManager');
const PreSpawnManager = require('./PreSpawnManager');


/**
 * Runs the 6-phase execution pipeline.
 */
function runPipeline() {
    // Update Bucket Forecaster early in the pipeline
    if (cpuBucketForecaster && typeof cpuBucketForecaster.update === 'function') {
        cpuBucketForecaster.update();
    }

    let throttlerFlags = {};
    const executeWrapped = (name, fn) => {
        if (!fn) return;
        wrap(name, fn)();
    };

    executeWrapped('cpuThrottler.run', () => {
        if (cpuThrottler && typeof cpuThrottler.run === 'function') {
            throttlerFlags = cpuThrottler.run() || {};
        }
    });

    const { skipState, skipColonies, skipManagers, skipOperations } = throttlerFlags;

    // Phase 1: OS Init & Cache
    executeWrapped('heapValidator.validate', () => {
        if (heapValidator && typeof heapValidator.validate === 'function') {
            heapValidator.validate();
        }
    });
    executeWrapped('GlobalResetDetector.detectAndHandleReset', () => {
        if (GlobalResetDetector && typeof GlobalResetDetector.detectAndHandleReset === 'function') {
            GlobalResetDetector.detectAndHandleReset();
        }
    });
    executeWrapped('GlobalStateRehydrator.rehydrateGlobalState', () => {
        if (GlobalStateRehydrator && typeof GlobalStateRehydrator.rehydrateGlobalState === 'function') {
            GlobalStateRehydrator.rehydrateGlobalState();
        }
    });
    executeWrapped('OSInitializer.init', () => {
        if (OSInitializer && typeof OSInitializer.init === 'function') {
            OSInitializer.init();
        }
    });
    executeWrapped('CacheRegistry.init', () => {
        if (!global.Cache) {
            const { CacheRegistry } = require('../os/cache');
            if (CacheRegistry && typeof CacheRegistry.init === 'function') {
                CacheRegistry.init();
            }
        }
    });
    executeWrapped('interShardMemoryManager._loadLocal', () => {
        if (interShardMemoryManager && typeof interShardMemoryManager._loadLocal === 'function') {
            interShardMemoryManager._loadLocal();
        }
    });
    executeWrapped('SystemScheduler.run', () => {
        if (SystemScheduler && typeof SystemScheduler.run === 'function') SystemScheduler.run();
    });

    // Phase 2: Global State
    executeWrapped('globalState.update', () => {
        if (globalState && typeof globalState.update === 'function') {
            globalState.update();
        }
    });
    executeWrapped('roomHasher', () => {
        if (global.State && global.State.rooms) {
            for (const roomName of global.State.rooms.keys()) {
                if (roomHasher && typeof roomHasher.generate === 'function') roomHasher.generate(roomName);
            }
        }
    });
    executeWrapped('discoveryManager', () => { if (discoveryManager) discoveryManager(); });

    if (!skipState) {
        executeWrapped('RoomEventManager', () => { if (roomEventManager) roomEventManager(); });
        executeWrapped('stateScanner.scan', () => {
            if (stateScanner && typeof stateScanner.scan === 'function') {
                stateScanner.scan();
            }
        });
        executeWrapped('EnergySourceTracker.run', () => { if (EnergySourceTracker && typeof EnergySourceTracker.run === 'function') EnergySourceTracker.run(); });
    }

    // Phase 3: Colonies
    if (!skipColonies) {
        executeWrapped('ledgerReset', () => { if (VirtualLedger && typeof VirtualLedger.clear === 'function') VirtualLedger.clear(); });

        const AssignmentUtility = registeredTopLevelManagers.get('AssignmentUtility');
        executeWrapped('AssignmentUtility.run', () => {
            if (AssignmentUtility && typeof AssignmentUtility.run === 'function') AssignmentUtility.run();
        });

        const colonyManager = registeredTopLevelManagers.get('colonyManager');
        executeWrapped('colonyManager.run', () => {
            if (colonyManager && typeof colonyManager.run === 'function') {
                colonyManager.run();
            }
        });

        executeWrapped('defconManager.run', () => {
            if (global.State && global.State.rooms && defconManager && typeof defconManager.run === 'function') {
                for (const room of global.State.rooms.values()) defconManager.run(room);
            }
        });

        const CreepAssignmentManager = registeredTopLevelManagers.get('CreepAssignmentManager');
        executeWrapped('CreepAssignmentManager.run', () => {
            if (global.State && global.State.rooms && CreepAssignmentManager && typeof CreepAssignmentManager.run === 'function') {
                for (const room of global.State.rooms.values()) {
                    const wrapMethod = require('../utils/ManagerExecutionWrapper').wrap;
                    wrapMethod('CreepAssignmentManager', () => CreepAssignmentManager.run(room))();
                }
            }
        });

        const PowerSpawnManager = registeredTopLevelManagers.get('PowerSpawnManager');
        executeWrapped('PowerSpawnManager.run', () => {
            if (global.State && global.State.rooms && PowerSpawnManager && typeof PowerSpawnManager.run === 'function') {
                for (const room of global.State.rooms.values()) {
                    const wrapMethod = require('../utils/ManagerExecutionWrapper').wrap;
                    wrapMethod('PowerSpawnManager', () => PowerSpawnManager.run(room))();
                }
            }
        });

        const RCLProgressionManager = registeredTopLevelManagers.get('RCLProgressionManager');
        executeWrapped('RCLProgressionManager.run', () => {
            if (global.State && global.State.rooms && RCLProgressionManager && typeof RCLProgressionManager.run === 'function') {
                for (const room of global.State.rooms.values()) RCLProgressionManager.run(room);
            }
        });
    }

    if (global.State && global.State.rooms) {
        if (typeof Game !== 'undefined' && Game.time % 10 === 0) {
            for (const room of global.State.rooms.values()) {
                if (room.controller && room.controller.my && spawnManager && typeof spawnManager.run === 'function') {
                    const ledger = new SpawnLedger(room);
                    executeWrapped('spawnManager.run', () => spawnManager.run(room, ledger));
                }
                if (room.controller && room.controller.my && BoostManager && typeof BoostManager.run === 'function') {
                    executeWrapped('BoostManager.run', () => BoostManager.run(room));
                }
            }
        }
        if (typeof Game !== 'undefined' && Game.time % 1000 === 0) {
            for (const room of global.State.rooms.values()) {
                if (room.controller && room.controller.my && planner && typeof planner.run === 'function') {
                    executeWrapped('planner.run', () => planner.run(room));
                }
            }
        }
    }

    if (!skipManagers) {
        executeWrapped('PreSpawnManager.run', () => {
            const preMgr = globalState ? globalState.getManager('PreSpawnManager') : (PreSpawnManager || null);
            if (preMgr && typeof preMgr.run === 'function') preMgr.run();
        });
        executeWrapped('runRoomManagers', () => {
            if (typeof runRoomManagers === 'function') runRoomManagers();
        });
        executeWrapped('RoleManager.runAll', () => { if (RoleManager && typeof RoleManager.runAll === 'function') RoleManager.runAll(); });
    }

    // Phase 4: Operations
    if (!skipOperations) {
        executeWrapped('AllianceIntelManager.run', () => {
            const intelMgr = globalState ? globalState.getManager('AllianceIntelManager') : (AllianceIntelManager || null);
            if (intelMgr && typeof intelMgr.run === 'function') intelMgr.run();
        });

        const operationsManager = registeredTopLevelManagers.get('operationsManager');
        executeWrapped('operationsManager.run', () => {
            if (operationsManager && typeof operationsManager.run === 'function') {
                operationsManager.run();
            }
        });
    }

    // Phase 5: Traffic Control
    executeWrapped('trafficManager.setup', () => {
        if (trafficManager && typeof trafficManager.setup === 'function') {
            trafficManager.setup();
        }
    });
    executeWrapped('trafficManager.run', () => {
        if (trafficManager && typeof trafficManager.run === 'function') {
            trafficManager.run();
        }
    });

    // Phase 6: Intents & Sleep
    executeWrapped('trafficManager.executeIntents', () => {
        if (trafficManager && typeof trafficManager.executeIntents === 'function') {
            trafficManager.executeIntents();
        }
    });
    executeWrapped('IntentManager.fireIntents', () => {
        if (global.State && global.State.intentManager && typeof global.State.intentManager.fireIntents === 'function') {
            global.State.intentManager.fireIntents();
        } else if (global.State && global.State.intentManager && typeof global.State.intentManager.fire === 'function') {
            global.State.intentManager.fire();
        }
    });
    executeWrapped('memoryProxy.serialize', () => {
        if (memoryProxy && typeof memoryProxy.serialize === 'function') {
            memoryProxy.serialize();
        }
    });
}


module.exports = {
    getRegisteredManager: (name) => registeredTopLevelManagers.get(name),
    init,
    runRoomManagers, // Exported for testing/mocking if needed
    runPipeline
};
