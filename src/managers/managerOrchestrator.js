const Profiler = require('../utils/profiler');
const globalState = require('../state/globalState');
const Logger = require('../utils/logger');
const { executeManager } = require('../utils/errorHandler');
const { wrapModuleFunctions } = require('../utils/moduleWrapper');

// Phase Managers
const discoveryManager = require('../state/discoveryManager');
const eventLogRadar = require('../os/eventLogRadar');
const stateScanner = require('../state/stateScanner');
const colonyManager = require('../colonies/colonyManager');
const spawnManager = require('../colonies/spawnManager');
const SpawnLedger = require('../colonies/spawnLedger');
const planner = require('../colonies/planner');
const RoleManager = require('../colonies/RoleManager');
const operationsManager = require('../operations/operationsManager');
const trafficManager = require('../traffic/trafficManager');

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
            { name: 'RoomEventManager', slice: 1 },
            { name: 'SpawnQueueManager', slice: 1 },
            { name: 'PreSpawnManager', slice: 1 },
            { name: 'LogisticsManager', slice: 1 },
            { name: 'LabManager', slice: 5 },
            { name: 'RemoteEconomyManager', slice: 5 },
            { name: 'MarketManager', slice: 10 },
            { name: 'TerminalManager', slice: 10 },
            { name: 'QuadSquadManager', slice: 1 }
        ];

        const registeredManagers = Object.keys(require('./index').managers);
        for (const name of registeredManagers) {
            if (!managersConfig.find(c => c.name === name)) {
                managersConfig.push({ name, slice: 1 });
            }
        }

        // Initialize Process Table in Heap
        if (!global.Cache) global.Cache = {};
        if (!global.Cache.processes) global.Cache.processes = new Map();

        for (const config of managersConfig) {
            // Process Scheduler (OS Sleep/Wake)
            const processId = `${room.name}_${config.name}`;
            const process = global.Cache.processes.get(processId);

            if (process && process.wakeTick && Game.time < process.wakeTick) {
                continue; // Process is asleep, drop idle execution cost to 0
            }

            // Fallback to legacy modulo tick-slicing if wakeTick is not set
            if ((!process || !process.wakeTick) && Game.time % config.slice !== 0) continue;

            let manager = globalState.getManager(config.name);
            if (manager && typeof manager.run === 'function') {
                // Ensure process object exists for the manager to modify its own wakeTick
                if (!process) {
                    global.Cache.processes.set(processId, { id: processId });
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
                manager.run(room, global.Cache.processes.get(processId));

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
function runPhase(phase, throttlerFlags = {}) {
    const { skipState, skipColonies, skipManagers, skipOperations } = throttlerFlags;

    switch(phase) {
        case 2:
            Logger.debug('Phase 2: Global State');
            executeManager('discoveryManager', () => { if (discoveryManager) discoveryManager(); });

            if (!skipState) {
                executeManager('eventLogRadar', () => { if (eventLogRadar) eventLogRadar(); });
                executeManager('stateScanner', () => { if (stateScanner) stateScanner(); });
                executeManager('globalState.scan', () => { if (globalState && globalState.scan) globalState.scan(); });

                executeManager('EnergyRequestManager', () => {
                    const energyRequestManager = globalState.getManager('EnergyRequestManager');
                    if (energyRequestManager && energyRequestManager.handleSourceSleep) {
                        energyRequestManager.handleSourceSleep();
                    }
                });
            }
            break;

        case 3:
            Logger.debug('Phase 3: Colonies');
            if (!skipColonies) {
                executeManager('colonyManager', () => { if (colonyManager) colonyManager(); });
            }

            if (global.State && global.State.rooms) {
                if (Game.time % 10 === 0) {
                    for (const room of global.State.rooms.values()) {
                        if (room.controller && room.controller.my && spawnManager && typeof spawnManager.run === 'function') {
                            const ledger = new SpawnLedger(room);
                            executeManager('spawnManager', () => spawnManager.run(room, ledger));
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
                executeManager('runRoomManagers', runRoomManagers);
                executeManager('RoleManager', () => RoleManager.runAll());
            }
            break;

        case 4:
            if (!skipOperations) {
                Logger.debug('Phase 4: Running Operations');
                executeManager('operationsManager', () => { if (operationsManager) operationsManager(); });
            }
            break;

        case 5:
            Logger.debug('Phase 5: Running Traffic Control');
            executeManager('trafficManager.run', () => { if (trafficManager && trafficManager.run) trafficManager.run(); });
            break;

        case 6:
            Logger.debug('Phase 6: Executing Intents & Sleep');
            executeManager('trafficManager.executeIntents', () => { if (trafficManager && trafficManager.executeIntents) trafficManager.executeIntents(); });
            break;
    }
}

module.exports = {
    runPhase: Profiler.wrap('managerOrchestrator.runPhase', runPhase),
    runRoomManagers // Exported for testing/mocking if needed
};
