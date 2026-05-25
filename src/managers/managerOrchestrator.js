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
            { name: 'ConstructionManager', slice: 1 },
            { name: 'LinkManager', slice: 1 },
            { name: 'StorageManager', slice: 1 },
            { name: 'LogisticsManager', slice: 1 },
            { name: 'LabManager', slice: 5 },
            { name: 'MarketManager', slice: 10 }
        ];

        if (room.controller.level < 6) {
            const prune = ['LabManager'];
            for (let i = managersConfig.length - 1; i >= 0; i--) {
                if (prune.includes(managersConfig[i].name)) {
                    managersConfig.splice(i, 1);
                }
            }
        }

        const registeredManagers = Object.keys(require('./index').managers);
        for (const name of registeredManagers) {
            // Exclude global or static managers from per-room execution
            if (['PreSpawnManager', 'SpawnQueueManager', 'RoomEventManager', 'AllianceIntelManager', 'CombatManager', 'EnergyRequestManager', 'VisualsManager', 'NukeEvacuationManager', 'RampartDefenseManager', 'TowerManager', 'UpgraderManager', 'RemoteEconomyManager', 'TerminalManager', 'QuadSquadManager'].includes(name)) {
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
    const eventBus = require('../os/eventBus');
    if (eventBus && typeof eventBus.init === 'function') {
        eventBus.init();
    }

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
const managersIntegration = Profiler.wrap('managersIntegration', require('./index'));


function run() {
    const cpuThrottler = require('../os/cpuThrottler');
    const OSOrchestrator = require('../os/OSOrchestrator');
    const GlobalStatePopulator = require('../state/GlobalStatePopulator');
    const colonyManager = require('../colonies/colonyManager');
    const operationsManager = require('../operations/operationsManager');
    const trafficManager = require('../traffic/trafficManager');
    const IntentManager = require('../os/IntentManager');
    const VisualsManager = require('./VisualsManager');
    const globalState = require('../state/globalState');
    const SystemScheduler = require('../os/SystemScheduler');
    const memoryProxy = require('../os/memoryProxy');
    const { wrapManager } = require('../utils/ManagerErrorBoundary');

    let throttlerFlags = {};
    if (cpuThrottler && typeof cpuThrottler.run === 'function') {
        throttlerFlags = cpuThrottler.run() || {};
    }

    const Profiler = require('../utils/profiler');
    const executeWrapped = (name, fn) => {
        if (!fn) return;
        wrapManager(Profiler.wrap(name, fn), name)();
    };

    // Phase 1: OS Init & Cache
    executeWrapped('managerOrchestrator.Phase1', () => {
        if (OSOrchestrator && typeof OSOrchestrator.run === 'function') {
            OSOrchestrator.run();
        }
    });

    // Phase 2: Global State
    if (!throttlerFlags.skipState) {
        executeWrapped('managerOrchestrator.Phase2', () => {
            if (GlobalStatePopulator && typeof GlobalStatePopulator.populate === 'function') {
                GlobalStatePopulator.populate(global.State);
            }

            const stateScanner = require('../state/stateScanner');
            if (stateScanner && typeof stateScanner.scan === 'function') {
                stateScanner.scan();
            }

            if (globalState && typeof globalState.update === 'function') {
                globalState.update();
            }

            if (OSOrchestrator && typeof OSOrchestrator.updateRoomHashes === 'function') {
                OSOrchestrator.updateRoomHashes();
            }

            const discoveryManager = require('../state/discoveryManager');
            if (discoveryManager && typeof discoveryManager === 'function') discoveryManager();

            const roomEventManager = require('./RoomEventManager');
            if (roomEventManager && typeof roomEventManager === 'function') roomEventManager();

            const EnergySourceTracker = require('./EnergySourceTracker');
            if (EnergySourceTracker && typeof EnergySourceTracker.run === 'function') EnergySourceTracker.run();
        });
    }

    // Phase 3: Colonies
    if (!throttlerFlags.skipColonies) {
        executeWrapped('managerOrchestrator.Phase3', () => {
            if (colonyManager && typeof colonyManager.run === 'function') {
                colonyManager.run();
            }

            const defconManager = require('../colonies/defconManager');
            if (global.State && global.State.rooms && defconManager && typeof defconManager.run === 'function') {
                for (const room of global.State.rooms.values()) defconManager.run(room);
            }

            // Execute legacy standalone room managers
            runRoomManagers();
        });
    }

    // Phase 4: Operations
    if (!throttlerFlags.skipOperations) {
        executeWrapped('managerOrchestrator.Phase4', () => {
            if (operationsManager && typeof operationsManager.run === 'function') {
                operationsManager.run();
            }
        });
    }

    // Phase 5: Traffic Control
    executeWrapped('managerOrchestrator.Phase5', () => {
        if (trafficManager && typeof trafficManager.setup === 'function') {
            trafficManager.setup();
        }
        if (trafficManager && typeof trafficManager.run === 'function') {
            trafficManager.run();
        }
    });

    // Phase 6: Intents & Sleep
    executeWrapped('managerOrchestrator.Phase6', () => {
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

        executeWrapped('VisualsManager.run', () => {
            if (VisualsManager && typeof VisualsManager.run === 'function') {
                VisualsManager.run();
            }
        });

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

module.exports = {
    run,
    getRegisteredManager: (name) => registeredTopLevelManagers.get(name),
    init,
    runRoomManagers, // Exported for testing/mocking if needed
};
