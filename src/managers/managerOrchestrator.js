const Profiler = require('../utils/profiler');
const globalState = require('../state/globalState');
const Logger = require('../utils/logger');
const { executeManager } = require('../utils/errorHandler');
const { wrapModuleFunctions } = require('../utils/moduleWrapper');

const colonyManager = require('../colonies/colonyManager');
const spawnManager = require('../colonies/spawnManager');
const planner = require('../colonies/planner');
const RoleManager = require('../colonies/RoleManager');
const operationsManager = require('../operations/operationsManager');
const trafficManager = require('../traffic/trafficManager');
const SpawnLedger = require('../colonies/spawnLedger');

/**
 * @file managerOrchestrator.js
 * @description Centralized execution module for standalone room managers.
 * Implements CPU throttling and error isolation to safely execute manager logic
 * without blocking the main execution loop.
 */

function runPhase(phase, throttlerFlags) {
    switch (phase) {
        case 2:
            if (!throttlerFlags.skipState) {
                executeManager('EnergyRequestManager.handleSourceSleep', () => {
                    const energyRequestManager = globalState.getManager('EnergyRequestManager');
                    if (energyRequestManager && energyRequestManager.handleSourceSleep) {
                        energyRequestManager.handleSourceSleep();
                    }
                });
            }
            break;

        case 3:
            if (!throttlerFlags.skipColonies) {
                executeManager('colonyManager', () => {
                    if (colonyManager) colonyManager();
                });

                // Tick Slicing for core colony loops
                if (Game.time % 10 === 0) {
                    for (const roomName in Game.rooms) {
                        const room = Game.rooms[roomName];
                        if (room.controller && room.controller.my && spawnManager && typeof spawnManager.run === 'function') {
                            executeManager('spawnManager.run', () => {
                                const ledger = new SpawnLedger(room);
                                spawnManager.run(room, ledger);
                            });
                        }
                    }
                }

                if (Game.time % 1000 === 0) {
                    for (const roomName in Game.rooms) {
                        const room = Game.rooms[roomName];
                        if (room.controller && room.controller.my && planner && typeof planner.run === 'function') {
                            executeManager('planner.run', () => planner.run(room));
                        }
                    }
                }

                executeManager('RoleManager.runAll', () => {
                    RoleManager.runAll();
                });
            }

            if (!throttlerFlags.skipManagers) {
                if (!global.State || !global.State.rooms) break;

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

                    for (const config of managersConfig) {
                        if (Game.time % config.slice !== 0) continue;

                        let manager = globalState.getManager(config.name);
                        if (manager && typeof manager.run === 'function') {
                            // Ensure the manager's methods are wrapped by the error handler
                            if (!manager.__errorWrapped) {
                                manager = wrapModuleFunctions(manager, (funcName, originalFunc, ...args) => {
                                    return executeManager(`${config.name}.${funcName}`, originalFunc, ...args);
                                });
                                manager.__errorWrapped = true;
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
                            manager.run(room);

                            if (profilerEnabled) {
                                const endCpu = cpuAvailable ? Game.cpu.getUsed() : Date.now();
                                Profiler.record(config.name, endCpu - startCpu);
                            }
                        }
                    }
                }
            }
            break;

        case 4:
            if (!throttlerFlags.skipOperations) {
                executeManager('operationsManager', () => {
                    if (operationsManager) operationsManager();
                });
            }
            break;

        case 5:
            executeManager('trafficManager.run', () => {
                if (trafficManager && trafficManager.run) trafficManager.run();
            });
            break;

        case 6:
            executeManager('trafficManager.executeIntents', () => {
                if (trafficManager && trafficManager.executeIntents) {
                    trafficManager.executeIntents();
                }
            });
            executeManager('intentManager.executeIntents', () => {
                if (global.State && global.State.intentManager) {
                    global.State.intentManager.executeIntents();
                }
            });
            break;

        default:
            Logger.error(`[Orchestrator] Unknown phase requested: ${phase}`);
            break;
    }
}

module.exports = {
    runPhase: Profiler.wrap('managerOrchestrator.runPhase', runPhase)
};
