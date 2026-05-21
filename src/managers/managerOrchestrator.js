const Profiler = require('../utils/profiler');
const globalState = Profiler.wrap('globalState', require('../state/globalState'));
const Logger = require('../utils/logger');
const { executeManager } = require('../utils/errorHandler');
const defconManager = Profiler.wrap('defconManager', require('../colonies/defconManager'));
const interShardMemoryManager = Profiler.wrap('interShardMemoryManager', require('../os/interShardMemoryManager'));
const RawMemoryManager = Profiler.wrap('RawMemoryManager', require('../os/RawMemoryManager'));
const memoryProxy = Profiler.wrap('memoryProxy', require('../os/memoryProxy'));
const VirtualLedger = require('../utils/VirtualLedger');
const roomHasher = Profiler.wrap('roomHasher', require('../os/roomHasher'));
const { wrapModuleFunctions } = require('../utils/moduleWrapper');
const errorHandler = require('../utils/errorHandler');
const heapValidator = Profiler.wrap('heapValidator', require('../os/heapValidator'));
const resetRecovery = Profiler.wrap('resetRecovery', require('../os/resetRecovery'));
const objectPool = Profiler.wrap('objectPool', require('../os/objectPool'));
const eventBus = Profiler.wrap('eventBus', require('../os/eventBus'));
const cpuBucketForecaster = Profiler.wrap('cpuBucketForecaster', require('../os/cpuBucketForecaster'));

// Phase Managers
const discoveryManager = Profiler.wrap('discoveryManager', require('../state/discoveryManager'));
const OSInitializer = Profiler.wrap('OSInitializer', require('../os/OSInitializer'));
const IntentManager = Profiler.wrap('IntentManager', require('../os/IntentManager'));
const eventLogRadar = Profiler.wrap('eventLogRadar', require('../os/eventLogRadar'));
const stateScanner = Profiler.wrap('stateScanner', require('../state/stateScanner'));
const colonyManager = Profiler.wrap('colonyManager', require('../colonies/colonyManager'));
const spawnManager = Profiler.wrap('spawnManager', require('../colonies/spawnManager'));
const SpawnLedger = require('../colonies/spawnLedger');
const BoostManager = Profiler.wrap('BoostManager', require('./BoostManager'));
const VisualsManager = Profiler.wrap('VisualsManager', require('./VisualsManager'));
const planner = Profiler.wrap('planner', require('../colonies/planner'));
const RoleManager = Profiler.wrap('RoleManager', require('../colonies/RoleManager'));
const operationsManager = Profiler.wrap('operationsManager', require('../operations/operationsManager'));
const trafficManager = Profiler.wrap('trafficManager', require('../traffic/trafficManager'));
const roomEventManager = Profiler.wrap('RoomEventManager', require('./RoomEventManager'));
const EnergySourceTracker = Profiler.wrap('EnergySourceTracker', require('./EnergySourceTracker'));

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

        // Initialize Process Table in Heap
        if (!global.Cache) {
            const { CacheRegistry } = require('../os/cache');
            CacheRegistry.init();
        }
        if (!global.Cache.has('processes')) global.Cache.set('processes', new Map());

        for (const config of managersConfig) {
            // Process Scheduler (OS Sleep/Wake)
            const processId = `${room.name}_${config.name}`;
            const process = global.Cache.get('processes').get(processId);

            if (process && process.wakeTick && Game.time < process.wakeTick) {
                continue; // Process is asleep, drop idle execution cost to 0
            }

            // Fallback to legacy modulo tick-slicing if wakeTick is not set
            if ((!process || !process.wakeTick) && Game.time % config.slice !== 0) continue;

            let manager = globalState.getManager(config.name);
            if (manager && typeof manager.run === 'function') {
                // Ensure process object exists for the manager to modify its own wakeTick
                if (!process) {
                    global.Cache.get('processes').set(processId, { id: processId });
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
                manager.run(room, global.Cache.get('processes').get(processId));

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
    registeredTopLevelManagers.set('trafficManager', typeof trafficManager !== 'undefined' ? trafficManager : Profiler.wrap('trafficManager', require('../traffic/trafficManager')));
    registeredTopLevelManagers.set('IntentManager', typeof IntentManager !== 'undefined' ? IntentManager : Profiler.wrap('IntentManager', require('../os/IntentManager')));

    let loadedRCLProgressionManager = require('../colonies/RCLProgressionManager');
    loadedRCLProgressionManager = Profiler.wrap('RCLProgressionManager', loadedRCLProgressionManager);
    registeredTopLevelManagers.set('RCLProgressionManager', loadedRCLProgressionManager);

    let loadedAssignmentUtility = require('../utils/AssignmentUtility');
    loadedAssignmentUtility = Profiler.wrap('AssignmentUtility', loadedAssignmentUtility);
    registeredTopLevelManagers.set('AssignmentUtility', loadedAssignmentUtility);
}

const cpuThrottler = Profiler.wrap('cpuThrottler', require('../os/cpuThrottler'));
const managersIntegration = Profiler.wrap('managersIntegration', require('./index'));

function run(externalThrottlerFlags = {}) {
    let throttlerFlags = externalThrottlerFlags;

    const executeWrapped = (name, fn) => {
        if (!fn) return;
        const profilerEnabled = global.PROFILER_ENABLED || (typeof Memory !== 'undefined' && Memory.PROFILER_ENABLED);
        const cpuAvailable = typeof Game !== 'undefined' && Game.cpu && typeof Game.cpu.getUsed === 'function';
        let startCpu;

        if (profilerEnabled) {
            startCpu = cpuAvailable ? Game.cpu.getUsed() : Date.now();
        }

        errorHandler.wrap(name, fn)();

        if (profilerEnabled) {
            const endCpu = cpuAvailable ? Game.cpu.getUsed() : Date.now();
            Profiler.record(name, endCpu - startCpu);
        }
    };

    // Phase 1: OS Init & Cache
    executeWrapped('OSInitializer.run', () => {
        const osInit = registeredTopLevelManagers.get('OSInitializer');
        if (osInit && typeof osInit.run === 'function') osInit.run();
    });
    executeWrapped('resetRecovery.check', () => { if (resetRecovery && typeof resetRecovery.check === 'function') resetRecovery.check(); });
    executeWrapped('heapValidator.validate', () => { if (heapValidator && typeof heapValidator.validate === 'function') heapValidator.validate(); });
    executeWrapped('memoryProxy.init', () => { if (memoryProxy && typeof memoryProxy.init === 'function') memoryProxy.init(); });
    executeWrapped('objectPool.init', () => { if (objectPool && typeof objectPool.init === 'function') objectPool.init(); });
    executeWrapped('eventBus.init', () => { if (eventBus && typeof eventBus.init === 'function') eventBus.init(); });
    executeWrapped('cpuBucketForecaster.update', () => { if (cpuBucketForecaster && typeof cpuBucketForecaster.update === 'function') cpuBucketForecaster.update(); });
    executeWrapped('trafficManager.setup', () => {
        const trfMgr = registeredTopLevelManagers.get('trafficManager');
        if (trfMgr && typeof trfMgr.setup === 'function') trfMgr.setup();
    });
    executeWrapped('interShardMemoryManager._loadLocal', () => {
        if (interShardMemoryManager && typeof interShardMemoryManager._loadLocal === 'function') interShardMemoryManager._loadLocal();
    });

    executeWrapped('cpuThrottler.throttle', () => {
        if (cpuThrottler && typeof cpuThrottler.throttle === 'function') {
            throttlerFlags = cpuThrottler.throttle() || {};
        }
    });
    executeWrapped('managersIntegration.init', () => {
        if (managersIntegration && typeof managersIntegration.init === 'function') {
            managersIntegration.init(registeredTopLevelManagers.get('globalState'));
        }
    });

    const { skipState, skipColonies, skipManagers, skipOperations } = throttlerFlags;

    // Phase 2: Global State
    executeWrapped('discoveryManager', () => { if (discoveryManager) discoveryManager(); });
    if (!skipState) {
        executeWrapped('eventLogRadar', () => { if (eventLogRadar) eventLogRadar(); });
        executeWrapped('RoomEventManager', () => { if (roomEventManager) roomEventManager(); });
        executeWrapped('stateScanner.scan', () => { if (stateScanner && typeof stateScanner.scan === 'function') stateScanner.scan(); });
        executeWrapped('globalState.scan', () => {
            const gState = registeredTopLevelManagers.get('globalState');
            if (gState && typeof gState.scan === 'function') gState.scan();
        });
        executeWrapped('roomHasher.generate', () => {
            if (global.State && global.State.rooms) {
                for (const roomName of global.State.rooms.keys()) {
                    if (roomHasher && typeof roomHasher.generate === 'function') roomHasher.generate(roomName);
                }
            }
        });
        executeWrapped('EnergySourceTracker.run', () => { if (EnergySourceTracker && typeof EnergySourceTracker.run === 'function') EnergySourceTracker.run(); });
    }

    // Phase 3: Colonies
    if (!skipColonies) {
        executeWrapped('AssignmentUtility.run', () => {
            const assignUtil = registeredTopLevelManagers.get('AssignmentUtility');
            if (assignUtil && typeof assignUtil.run === 'function') assignUtil.run();
        });
        executeWrapped('ledgerReset', () => { if (VirtualLedger && typeof VirtualLedger.clear === 'function') VirtualLedger.clear(); });
        executeWrapped('colonyManager.run', () => {
            const colMgr = registeredTopLevelManagers.get('colonyManager');
            if (colMgr && typeof colMgr.run === 'function') colMgr.run();
        });
        executeWrapped('defconManager.run', () => {
            if (global.State && global.State.rooms && defconManager && typeof defconManager.run === 'function') {
                for (const room of global.State.rooms.values()) defconManager.run(room);
            }
        });
        executeWrapped('RCLProgressionManager.run', () => {
            const rclMgr = registeredTopLevelManagers.get('RCLProgressionManager');
            if (global.State && global.State.rooms && rclMgr && typeof rclMgr.run === 'function') {
                for (const room of global.State.rooms.values()) rclMgr.run(room);
            }
        });
    }

    if (global.State && global.State.rooms) {
        if (Game.time % 10 === 0) {
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
        if (Game.time % 1000 === 0) {
            for (const room of global.State.rooms.values()) {
                if (room.controller && room.controller.my && planner && typeof planner.run === 'function') {
                    executeWrapped('planner.run', () => planner.run(room));
                }
            }
        }
    }

    if (!skipManagers) {
        executeWrapped('PreSpawnManager.run', () => {
            const preMgr = registeredTopLevelManagers.get('globalState') ? registeredTopLevelManagers.get('globalState').getManager('PreSpawnManager') : null;
            if (preMgr && typeof preMgr.run === 'function') preMgr.run();
        });
        executeWrapped('runRoomManagers', () => runRoomManagers());
        executeWrapped('RoleManager.runAll', () => { if (RoleManager && typeof RoleManager.runAll === 'function') RoleManager.runAll(); });
    }

    // Phase 4: Operations
    if (!skipOperations) {
        executeWrapped('AllianceIntelManager.run', () => {
            const intelMgr = registeredTopLevelManagers.get('globalState') ? registeredTopLevelManagers.get('globalState').getManager('AllianceIntelManager') : null;
            if (intelMgr && typeof intelMgr.run === 'function') intelMgr.run();
        });
        executeWrapped('operationsManager.run', () => {
            const opMgr = registeredTopLevelManagers.get('operationsManager');
            if (opMgr && typeof opMgr.run === 'function') opMgr.run();
        });
        executeWrapped('RawMemoryManager.init', () => {
            if (RawMemoryManager && typeof RawMemoryManager.init === 'function') RawMemoryManager.init();
        });
    }

    // Phase 5: Traffic Control
    executeWrapped('trafficManager.run', () => {
        const trfMgr = registeredTopLevelManagers.get('trafficManager');
        if (trfMgr && typeof trfMgr.run === 'function') trfMgr.run();
    });
    executeWrapped('PipelineLock.clear', () => {
        if (global.State && global.State.pipelineLedger) {
            global.State.pipelineLedger.clear();
        }
    });

    // Phase 6: Intents & Sleep
    executeWrapped('trafficManager.executeIntents', () => {
        const trfMgr = registeredTopLevelManagers.get('trafficManager');
        if (trfMgr && typeof trfMgr.executeIntents === 'function') trfMgr.executeIntents();
    });
    executeWrapped('IntentManager.fire', () => {
        if (global.State && global.State.intentManager && typeof global.State.intentManager.fire === 'function') {
            global.State.intentManager.fire();
        } else {
            const intMgr = registeredTopLevelManagers.get('IntentManager');
            if (intMgr && typeof intMgr.fire === 'function') intMgr.fire();
        }
    });
    executeWrapped('memoryProxy.serialize', () => { if (memoryProxy && typeof memoryProxy.serialize === 'function') memoryProxy.serialize(); });

    if (typeof Game !== 'undefined' && Game.cpu && Game.cpu.bucket > 5000 && VisualsManager && typeof VisualsManager.run === 'function') {
        executeWrapped('VisualsManager.run', () => VisualsManager.run());
    }
}


module.exports = {
    init,
    run: Profiler.wrap('managerOrchestrator.run', run),
    runRoomManagers // Exported for testing/mocking if needed
};
