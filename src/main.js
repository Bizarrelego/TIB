const { CacheRegistry } = require('./os/cache');
const RawMemoryManager = require('./os/RawMemoryManager');
const installMemoryProxy = require('./os/memoryProxy');
const globalState = require('./state/globalState');
const managersIntegration = require('./managers/index');
const discoveryManager = require('./state/discoveryManager');
const stateScanner = require('./state/stateScanner');
const colonyManager = require('./colonies/colonyManager');
const operationsManager = require('./operations/operationsManager'); // High-level orchestrator
const managerOrchestrator = require('./managers/managerOrchestrator'); // Standalone Managers
const trafficManager = require('./traffic/trafficManager');
const movement = require('./utils/movement');

module.exports.loop = function () {
    // Install memory proxy to bind heap to Creep prototypes
    installMemoryProxy();

    // Initialize RawMemory segments
    try {
        RawMemoryManager.init();
    } catch (e) {
        console.log(`[Phase 0 Error] RawMemoryManager: ${e.stack}`);
    }

    // Rehydrate global state
    globalState.rehydrate();

    // Initialize managers via integration layer
    managersIntegration.init(globalState);

    // Initialize OS cache
    if (!global.Cache) {
        CacheRegistry.init();
    }

    // Phase 1: Discovery Manager (Raw Engine API execution & global.State Bootstrapping)
    try {
        if (discoveryManager) discoveryManager();
    } catch (e) {
        console.log(`[Phase 1 Error] Discovery Manager: ${e.stack}`);
        return; // Fatal OS crash
    }

    // Cascading CPU Throttling based on Game.cpu.bucket
    let skipState = false;
    let skipColonies = false;
    let skipManagers = false;
    let skipOperations = false;

    switch (true) {
        case Game.cpu.bucket < 100:
            skipState = true;
            // fallthrough
        case Game.cpu.bucket < 500:
            skipColonies = true;
            skipManagers = true;
            // fallthrough
        case Game.cpu.bucket < 2000:
            skipOperations = true;
            // fallthrough
        default:
            break;
    }

    // Phase 2: State Scanner (Event-driven map updaters)
    if (!skipState) {
        try {
            const roomEventManager = globalState.getManager('RoomEventManager');
            if (roomEventManager) roomEventManager();
        } catch (e) {
            console.log(`[Phase 2 Error] Room Event Manager: ${e.stack}`);
        }

        try {
            if (stateScanner) stateScanner();
        } catch (e) {
            console.log(`[Phase 2 Error] Global State Scanner: ${e.stack}`);
        }
    }

    // Phase 2.5: Execution Gates
    try {
        const energyRequestManager = globalState.getManager('EnergyRequestManager');
        if (energyRequestManager && energyRequestManager.handleSourceSleep) {
            energyRequestManager.handleSourceSleep();
        }
    } catch (e) {
        console.log(`[Phase 2.5 Error] EnergyRequestManager: ${e.stack}`);
    }

    try {
        if (global.State.creepsByRoom) {
            for (const roomCreeps of global.State.creepsByRoom.values()) {
                for (const [role, creepsArray] of roomCreeps.entries()) {
                    const activeCreeps = creepsArray.filter(creep => !movement.checkFatigue(creep));
                    roomCreeps.set(role, activeCreeps);
                }
            }
        }
    } catch (e) {
        console.log(`[Phase 2.5 Error] Execution Gates: ${e.stack}`);
    }

    // Phase 3: Colonies
    if (!skipColonies) {
        try {
            if (colonyManager) colonyManager();
        } catch (e) {
            console.log(`[Phase 3 Error] Colonies: ${e.stack}`);
        }
    }

    // Phase 3.5: Standalone Managers
    if (!skipManagers) {
        try {
            if (managerOrchestrator && managerOrchestrator.run) managerOrchestrator.run();
        } catch (e) {
            console.log(`[Phase 3.5 Error] Managers: ${e.stack}`);
        }
    }

    // Phase 4: Operations Orchestration Module
    if (!skipOperations) {
        try {
            if (operationsManager) operationsManager();
        } catch (e) {
            console.log(`[Phase 4 Error] Operations: ${e.stack}`);
        }
    }

    // Phase 5: Traffic Control
    try {
        if (trafficManager && trafficManager.run) trafficManager.run();
    } catch (e) {
        console.log(`[Phase 5 Error] Traffic Control: ${e.stack}`);
    }

    // Phase 6: Intents & Sleep
    try {
        if (trafficManager && trafficManager.executeIntents) {
            trafficManager.executeIntents();
        }
    } catch (e) {
        console.log(`[Phase 6 Error] Intents & Sleep: ${e.stack}`);
    }

    // Profiler output
    const Profiler = require('./utils/profiler');
    Profiler.report();
};
