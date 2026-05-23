const Profiler = require('./utils/profiler');
const GlobalStateRehydrator = require('./os/GlobalStateRehydrator');
const OSInitializer = require('./os/OSInitializer');
const resetRecovery = Profiler.wrap('resetRecovery', require('./os/resetRecovery'));
const managerOrchestrator = Profiler.wrap('managerOrchestrator', require('./managers/managerOrchestrator')); // Standalone Managers

// Phase Managers
const discoveryManager = Profiler.wrap('discoveryManager', require('./state/discoveryManager'));
const stateScanner = Profiler.wrap('stateScanner', require('./state/stateScanner'));
const spawnManager = Profiler.wrap('spawnManager', require('./colonies/spawnManager'));
const SpawnLedger = require('./colonies/spawnLedger');
const BoostManager = Profiler.wrap('BoostManager', require('./managers/BoostManager'));
const VisualsManager = Profiler.wrap('VisualsManager', require('./managers/VisualsManager'));
const planner = Profiler.wrap('planner', require('./colonies/planner'));
const RoleManager = Profiler.wrap('RoleManager', require('./colonies/RoleManager'));
const roomEventManager = Profiler.wrap('RoomEventManager', require('./managers/RoomEventManager'));
const EnergySourceTracker = Profiler.wrap('EnergySourceTracker', require('./managers/EnergySourceTracker'));
const trafficManager = require('./traffic/trafficManager');
const IntentManager = require('./os/IntentManager');
const SystemScheduler = require('./os/SystemScheduler');
const roomHasher = require('./os/roomHasher');
const GlobalResetDetector = require('./os/GlobalResetDetector');
const interShardMemoryManager = require('./os/interShardMemoryManager');
const memoryProxy = require('./os/memoryProxy');
const defconManager = Profiler.wrap('defconManager', require('./colonies/defconManager'));
const VirtualLedger = require('./utils/VirtualLedger');
const globalState = Profiler.wrap('globalState', require('./state/globalState'));
const cpuThrottler = Profiler.wrap('cpuThrottler', require('./os/cpuThrottler'));
const managersIntegration = Profiler.wrap('managersIntegration', require('./managers/index'));

const { wrap } = require('./utils/ManagerExecutionWrapper');
const Logger = require('./utils/logger');
const { executeManager } = require('./utils/errorHandler');
const { wrapManager } = require('./utils/ManagerErrorBoundary');


module.exports.loop = wrapManager(Profiler.wrap('main.loop', function () {
    if (!global.hasRunThisTick) {
        global.hasRunThisTick = true;
        OSInitializer.init();
        GlobalStateRehydrator.rehydrateGlobalState();
    }

    if (!Memory.os_initialized && global.Cache) {
        global.Cache = undefined;
        global.State = undefined;
    }

    Logger.info(`--- Starting Tick ${Game.time} ---`);

    // Tick-level utilities

    executeManager('managerOrchestrator.init', () => managerOrchestrator.init());


    let throttlerFlags = {};
    const executeWrapped = (name, fn) => {
        if (!fn) return;
        wrapManager(fn, name)();
    };

    executeWrapped('cpuThrottler.throttle', () => {
        if (cpuThrottler && typeof cpuThrottler.throttle === 'function') {
            throttlerFlags = cpuThrottler.throttle() || {};
        }
    });
    executeWrapped('managersIntegration.init', () => {
        if (managersIntegration && typeof managersIntegration.init === 'function') {
            managersIntegration.init(globalState);
        }
    });

    const { skipState, skipColonies, skipManagers, skipOperations } = throttlerFlags;

    // Phase 1: OS Init & Cache
    executeWrapped('GlobalResetDetector', () => {
        if (GlobalResetDetector && typeof GlobalResetDetector.detectAndHandleReset === 'function') {
            GlobalResetDetector.detectAndHandleReset();
        }
    });
    executeWrapped('OSInitializer', () => {
        if (OSInitializer && typeof OSInitializer.init === 'function') OSInitializer.init();
    });
    executeWrapped('interShardMemoryManager._loadLocal', () => {
        if (interShardMemoryManager && typeof interShardMemoryManager._loadLocal === 'function') {
            interShardMemoryManager._loadLocal();
        }
    });

    executeWrapped('SystemScheduler', () => {
        if (SystemScheduler && typeof SystemScheduler.run === 'function') SystemScheduler.run();
    });

    // Phase 2: Global State
    executeWrapped('globalState.update', () => {
        if (globalState && typeof globalState.update === 'function') globalState.update();
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
        executeWrapped('stateScanner.scan', () => { if (stateScanner && typeof stateScanner.scan === 'function') stateScanner.scan(); });
        executeWrapped('EnergySourceTracker.run', () => { if (EnergySourceTracker && typeof EnergySourceTracker.run === 'function') EnergySourceTracker.run(); });
    }

    // Phase 3: Colonies
    if (!skipColonies) {
        const AssignmentUtility = managerOrchestrator.getRegisteredManager('AssignmentUtility');
        executeWrapped('AssignmentUtility.run', () => {
            if (AssignmentUtility && typeof AssignmentUtility.run === 'function') AssignmentUtility.run();
        });
        executeWrapped('ledgerReset', () => { if (VirtualLedger && typeof VirtualLedger.clear === 'function') VirtualLedger.clear(); });
        const colonyManager = managerOrchestrator.getRegisteredManager('colonyManager');
        executeWrapped('colonyManager.run', () => {
            if (colonyManager && typeof colonyManager.run === 'function') colonyManager.run();
        });
        executeWrapped('defconManager.run', () => {
            if (global.State && global.State.rooms && defconManager && typeof defconManager.run === 'function') {
                for (const room of global.State.rooms.values()) defconManager.run(room);
            }
        });

        const CreepAssignmentManager = managerOrchestrator.getRegisteredManager('CreepAssignmentManager');
        executeWrapped('CreepAssignmentManager.run', () => {
            if (global.State && global.State.rooms && CreepAssignmentManager && typeof CreepAssignmentManager.run === 'function') {
                for (const room of global.State.rooms.values()) wrap('CreepAssignmentManager', () => CreepAssignmentManager.run(room))();
            }
        });

        const PowerSpawnManager = managerOrchestrator.getRegisteredManager('PowerSpawnManager');
        executeWrapped('PowerSpawnManager.run', () => {
            if (global.State && global.State.rooms && PowerSpawnManager && typeof PowerSpawnManager.run === 'function') {
                for (const room of global.State.rooms.values()) wrap('PowerSpawnManager', () => PowerSpawnManager.run(room))();
            }
        });

        const RCLProgressionManager = managerOrchestrator.getRegisteredManager('RCLProgressionManager');
        executeWrapped('RCLProgressionManager.run', () => {
            if (global.State && global.State.rooms && RCLProgressionManager && typeof RCLProgressionManager.run === 'function') {
                for (const room of global.State.rooms.values()) RCLProgressionManager.run(room);
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
            const preMgr = globalState ? globalState.getManager('PreSpawnManager') : null;
            if (preMgr && typeof preMgr.run === 'function') preMgr.run();
        });
        executeWrapped('runRoomManagers', () => {
            if (managerOrchestrator.runRoomManagers) managerOrchestrator.runRoomManagers();
        });
        executeWrapped('RoleManager.runAll', () => { if (RoleManager && typeof RoleManager.runAll === 'function') RoleManager.runAll(); });
    }

    // Phase 4: Operations
    if (!skipOperations) {
        executeWrapped('AllianceIntelManager.run', () => {
            const intelMgr = globalState ? globalState.getManager('AllianceIntelManager') : null;
            if (intelMgr && typeof intelMgr.run === 'function') intelMgr.run();
        });

        const operationsManager = managerOrchestrator.getRegisteredManager('operationsManager');
        executeWrapped('operationsManager.run', () => {
            if (operationsManager && typeof operationsManager.run === 'function') operationsManager.run();
        });
    }

    if (typeof Game !== 'undefined' && Game.cpu && Game.cpu.bucket > 5000 && VisualsManager && typeof VisualsManager.run === 'function') {
        executeWrapped('VisualsManager.run', () => VisualsManager.run());
    }

    // Phase 5: Traffic Control
    executeWrapped('trafficManager.setup', () => {
        if (trafficManager && typeof trafficManager.setup === 'function') trafficManager.setup();
    });
    executeWrapped('trafficManager.run', () => {
        if (trafficManager && typeof trafficManager.run === 'function') trafficManager.run();
    });

    // Phase 6: Intents & Sleep
    executeWrapped('trafficManager.executeIntents', () => {
        if (trafficManager && typeof trafficManager.executeIntents === 'function') trafficManager.executeIntents();
    });
    executeWrapped('IntentManager.fireIntents', () => {
        if (global.State && global.State.intentManager && typeof global.State.intentManager.fireIntents === 'function') {
            global.State.intentManager.fireIntents();
        } else if (global.State && global.State.intentManager && typeof global.State.intentManager.fire === 'function') {
            global.State.intentManager.fire();
        }
    });
    executeWrapped('memoryProxy.serialize', () => {
        if (memoryProxy && typeof memoryProxy.serialize === 'function') memoryProxy.serialize();
    });


    // Profiler output
    executeManager('Profiler.report', () => Profiler.report());

    // Save caches state for reset recovery
    executeManager('resetRecovery.saveState', () => resetRecovery.saveState());
}), 'main.loop');
