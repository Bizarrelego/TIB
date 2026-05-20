const Profiler = require('../utils/profiler');
const globalState = require('../state/globalState');
const Logger = require('../utils/logger');
const { executeManager } = require('../utils/errorHandler');
const defconManager = require('../colonies/defconManager');
const interShardMemoryManager = require('../os/interShardMemoryManager');
const RawMemoryManager = require('../os/RawMemoryManager');
const { PipelineLock } = require('../os/PipelineLock');
const memoryProxy = require('../os/memoryProxy');
const VirtualLedger = require('../utils/VirtualLedger');
const roomHasher = require('../os/roomHasher');
const { wrapModuleFunctions } = require('../utils/moduleWrapper');

// Phase Managers
const discoveryManager = require('../state/discoveryManager');
const OSInitializer = require('../os/OSInitializer');
const IntentManager = require('../os/IntentManager');
const eventLogRadar = require('../os/eventLogRadar');
const stateScanner = require('../state/stateScanner');
const colonyManager = require('../colonies/colonyManager');
const spawnManager = require('../colonies/spawnManager');
const SpawnLedger = require('../colonies/spawnLedger');
const BoostManager = require('./BoostManager');
const VisualsManager = require('./VisualsManager');
const planner = require('../colonies/planner');
const RoleManager = require('../colonies/RoleManager');
const operationsManager = require('../operations/operationsManager');
const trafficManager = require('../traffic/trafficManager');
const roomEventManager = require('./RoomEventManager');
const EnergySourceTracker = require('./EnergySourceTracker');

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
    registeredTopLevelManagers.set('OSInitializer', typeof OSInitializer !== 'undefined' ? OSInitializer : require('../os/OSInitializer'));
    registeredTopLevelManagers.set('globalState', typeof globalState !== 'undefined' ? globalState : require('../state/globalState'));
    registeredTopLevelManagers.set('colonyManager', typeof colonyManager !== 'undefined' ? colonyManager : require('../colonies/colonyManager'));
    registeredTopLevelManagers.set('operationsManager', typeof operationsManager !== 'undefined' ? operationsManager : require('../operations/operationsManager'));
    registeredTopLevelManagers.set('trafficManager', typeof trafficManager !== 'undefined' ? trafficManager : require('../traffic/trafficManager'));
    registeredTopLevelManagers.set('IntentManager', typeof IntentManager !== 'undefined' ? IntentManager : require('../os/IntentManager'));
}

const cpuThrottler = require('../os/cpuThrottler');
const managersIntegration = require('./index');

function run(externalThrottlerFlags = {}) {
    let throttlerFlags = externalThrottlerFlags;

    for (let phase = 1; phase <= 6; phase++) {
        module.exports.runPhase(phase, throttlerFlags);

        // After Phase 1 (OS Init & Cache) we have global state rehydrated.
        // We must calculate throttler flags and register all integration managers
        // before we continue to Phase 2 (Global State).
        if (phase === 1) {
            executeManager('cpuThrottler.run', () => {
                throttlerFlags = cpuThrottler.run() || {};
            });
            executeManager('managersIntegration.init', () => managersIntegration.init(registeredTopLevelManagers.get('globalState')));
        }
    }
}

function runPhase(phase, throttlerFlags = {}) {
    const { skipState, skipColonies, skipManagers, skipOperations } = throttlerFlags;

    switch(phase) {

        case 1:
            Logger.debug('Phase 1: OS Init & Cache');
            executeManager('OSInitializer', () => {
                const osInit = registeredTopLevelManagers.get('OSInitializer');
                if (osInit) {
                    osInit.init();
                }
            });
            executeManager('trafficManager.setup', () => {
                const trfMgr = registeredTopLevelManagers.get('trafficManager');
                if (trfMgr && trfMgr.setup) {
                    trfMgr.setup();
                }
            });
            break;

        case 2:
            Logger.debug('Phase 2: Global State');
            executeManager('discoveryManager', () => { if (discoveryManager) discoveryManager(); });

            if (!skipState) {
                executeManager('eventLogRadar', () => { if (eventLogRadar) eventLogRadar(); });
                executeManager('RoomEventManager', () => {
                    if (roomEventManager) roomEventManager();
                });
                executeManager('stateScanner', () => { if (stateScanner) stateScanner(); });
                executeManager('globalState.scan', () => {
                    const gState = registeredTopLevelManagers.get('globalState');
                    if (gState && gState.scan) gState.scan();
                });

                executeManager('roomHasher', () => {
                    if (global.State && global.State.rooms) {
                        for (const roomName of global.State.rooms.keys()) {
                            roomHasher.generate(roomName);
                        }
                    }
                });

                executeManager('EnergySourceTracker.run', () => {
                    if (EnergySourceTracker && EnergySourceTracker.run) EnergySourceTracker.run();
                });
            }
            break;

        case 3:
            Logger.debug('Phase 3: Colonies');
            if (!skipColonies) {
                executeManager('ledgerReset', () => { VirtualLedger.clear(); });
                executeManager('colonyManager', () => {
                    const colMgr = registeredTopLevelManagers.get('colonyManager');
                    if (colMgr) colMgr();
                });
                executeManager('defconManager', () => { if (global.State && global.State.rooms) { for (const room of global.State.rooms.values()) { defconManager.run(room); } } });
            }

            if (global.State && global.State.rooms) {
                if (Game.time % 10 === 0) {
                    for (const room of global.State.rooms.values()) {
                        if (room.controller && room.controller.my && spawnManager && typeof spawnManager.run === 'function') {
                            const ledger = new SpawnLedger(room);
                            executeManager('spawnManager', () => spawnManager.run(room, ledger));
                        }
                        if (room.controller && room.controller.my && BoostManager && typeof BoostManager.run === 'function') {
                            executeManager('BoostManager', () => BoostManager.run(room));
                        }
                    }
                }

                if (Game.time % 1000 === 0) {
                    for (const room of global.State.rooms.values()) {
                        if (room.controller && room.controller.my && planner && typeof planner.run === 'function') {
                            executeManager('planner', () => planner.run(room));
                        }
                    }
                }
            }

            if (!skipManagers) {
                executeManager('PreSpawnManager.run', () => {
                    const PreSpawnManager = globalState.getManager('PreSpawnManager');
                    if (PreSpawnManager && typeof PreSpawnManager.run === 'function') PreSpawnManager.run();
                });
                executeManager('runRoomManagers', runRoomManagers);
                executeManager('RoleManager', () => RoleManager.runAll());
            }
            break;

        case 4:
            if (!skipOperations) {
                Logger.debug('Phase 4: Running Operations');
                executeManager('AllianceIntelManager.run', () => {
                    const AllianceIntelManager = globalState.getManager('AllianceIntelManager');
                    if (AllianceIntelManager && typeof AllianceIntelManager.run === 'function') AllianceIntelManager.run();
                });
                executeManager('operationsManager', () => {
                    const opMgr = registeredTopLevelManagers.get('operationsManager');
                    if (opMgr) opMgr();
                });
                executeManager('interShardMemoryManager', () => { if (interShardMemoryManager && typeof interShardMemoryManager._loadLocal === 'function') { interShardMemoryManager._loadLocal(); } });
                executeManager('RawMemoryManager.init', () => { if (RawMemoryManager && typeof RawMemoryManager.init === 'function') { RawMemoryManager.init(); } });
            }
            break;

        case 5:
            Logger.debug('Phase 5: Running Traffic Control');
            executeManager('trafficManager.run', () => {
                const trfMgr = registeredTopLevelManagers.get('trafficManager');
                if (trfMgr && trfMgr.run) trfMgr.run();
            });
            executeManager('PipelineLock.clear', () => { const lock = new PipelineLock(); lock.clear(); });
            break;

        case 6:
            Logger.debug('Phase 6: Executing Intents & Sleep');
            executeManager('trafficManager.executeIntents', () => {
                const trfMgr = registeredTopLevelManagers.get('trafficManager');
                if (trfMgr && trfMgr.executeIntents) trfMgr.executeIntents();
            });

            executeManager('IntentManager.executeIntents', () => {
                if (global.State && global.State.intentManager && typeof global.State.intentManager.executeIntents === 'function') {
                    global.State.intentManager.executeIntents();
                } else if (registeredTopLevelManagers.get('IntentManager')) {
                    // Fallback to static class call if it's implemented there
                }
            });

            executeManager('memoryProxy.serialize', () => { if (memoryProxy && typeof memoryProxy.serialize === 'function') { memoryProxy.serialize(); } });

            if (Game.cpu.bucket > 5000 && VisualsManager && typeof VisualsManager.run === 'function') {
                executeManager('VisualsManager', () => VisualsManager.run());
            }
            break;
    }
}

module.exports = {
    init,
    run: Profiler.wrap('managerOrchestrator.run', run),
    runPhase: Profiler.wrap('managerOrchestrator.runPhase', runPhase),
    runRoomManagers // Exported for testing/mocking if needed
};
