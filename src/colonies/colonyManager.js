const { wrap } = require('../utils/ManagerExecutionWrapper');
const { wrapManager } = require('../utils/ManagerErrorBoundary');
const workerManager = require('../managers/workerManager');
const SourceManager = require('../managers/SourceManager');

const SpawnLedger = require('./spawnLedger');
const defense = require('./defense');
const scavengingManager = require('./scavengingManager');
const spawnManager = require('./spawnManager');
const MiningPlanner = require('./MiningPlanner');
const RCLProgressionManager = require('./RCLProgressionManager');
const LogisticsManager = require('./logisticsManager');
const defconManager = require('./defconManager');
const BaseLayoutOptimizer = require('./BaseLayoutOptimizer');
const CreepRoleBalancer = require('./CreepRoleBalancer');
const TowerManager = require('../managers/TowerManager');
const RampartDefenseManager = require('../managers/RampartDefenseManager');
const NukeEvacuationManager = require('../managers/NukeEvacuationManager');
const UpgraderManager = require('../managers/UpgraderManager');
const RemoteEconomyManager = require('../managers/RemoteEconomyManager');
const TerminalManager = require('../managers/TerminalManager');
const PreSpawnManager = require('../managers/PreSpawnManager');
const EnergyRequestManager = require('../managers/EnergyRequestManager');
const MarketArbitrageAnalyzer = require('./MarketArbitrageAnalyzer');
const MarketOrderAnalyzer = require('./MarketOrderAnalyzer');
const MarketOrderExecutor = require('./MarketOrderExecutor');
const ResourceTransferLedger = require('./ResourceTransferLedger');
const SpawnEnergyReservations = require('./SpawnEnergyReservations');
const haulerSizing = require('./haulerSizing');
const killboxPlanner = require('./killboxPlanner');
const labs = require('./labs');
const logistics = require('./logistics');
const market = require('./market');
const planner = require('./planner');
const rampartPlanner = require('./rampartPlanner');

/**
 * Executes core colony management loop.
 * Orchestrates all colony-level managers, grouping them into logical phases:
 * 1. Global Ledger & Tracking Updates
 * 2. Colony Analysis & Planning (Layout, Defcon, Heatmaps)
 * 3. Execution & Logistics (Scavenging, Internal Transport, Markets, Roles)
 * 4. Progression & Spawning (RCL Checks, Spawning Queue)
 * Instantiates the SpawnLedger to track energy use during the tick,
 * passing it as a singleton-like service to spawnManager.
 */
const { executeManager } = require('../utils/errorHandler');
const Profiler = require('../utils/profiler');
const Logger = require('../utils/logger');
const globalState = require('../state/globalState');
const { wrapModuleFunctions } = require('../utils/moduleWrapper');

function runRoomManagers() {
    if (!global.State || !global.State.rooms) return;

    for (const roomName of global.State.rooms.keys()) {
        const room = global.State.rooms.get(roomName);

        if (!room || !room.controller || !room.controller.my) continue;

        const roomCreeps = global.State.creepsByRoom.get(room.name);
        if (roomCreeps) {
            const haulers = roomCreeps.get('hauler') || [];
            const domHaulers = roomCreeps.get('domesticHauler') || [];
            const harvesters = roomCreeps.get('harvester') || [];

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

        const registeredManagers = Object.keys(require('../managers/index').managers);
        for (const name of registeredManagers) {
            if (['PreSpawnManager', 'SpawnQueueManager', 'RoomEventManager', 'AllianceIntelManager', 'CombatManager', 'EnergyRequestManager', 'VisualsManager', 'NukeEvacuationManager', 'RampartDefenseManager', 'TowerManager', 'UpgraderManager', 'RemoteEconomyManager', 'TerminalManager', 'QuadSquadManager'].includes(name)) {
                continue;
            }
            if (!managersConfig.find(c => c.name === name)) {
                managersConfig.push({ name, slice: 1 });
            }
        }

        let TickSlicer;
        try {
            TickSlicer = require('../os/TickSlicer');
        } catch (e) {}

        if (!global.Cache) {
            const { CacheRegistry } = require('../os/cache');
            CacheRegistry.init();
        }
        if (!global.Cache.has('processes')) global.Cache.set('processes', new Map());

        for (const config of managersConfig) {
            let processId = `${room.name}_${config.name}`;
            let processObj = global.Cache.get('processes').get(processId);

            if (TickSlicer && typeof TickSlicer.shouldRun === 'function') {
                if (!TickSlicer.shouldRun(config.name, room.name)) continue;
            } else {
                if (processObj && processObj.wakeTick && Game.time < processObj.wakeTick) {
                    continue;
                }

                if ((!processObj || !processObj.wakeTick) && Game.time % config.slice !== 0) continue;
            }

            let manager = globalState.getManager(config.name);
            if (manager && typeof manager.run === 'function') {
                if (!processObj) {
                    processObj = { id: processId };
                    global.Cache.get('processes').set(processId, processObj);
                }
                if (!manager.__errorWrapped) {
                    manager = wrapModuleFunctions(manager, (funcName, originalFunc, ...args) => {
                        return executeManager(`${config.name}.${funcName}`, originalFunc, ...args);
                    });
                    manager.__errorWrapped = true;
                }

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

                manager.run(room, processObj);

                if (profilerEnabled) {
                    const endCpu = cpuAvailable ? Game.cpu.getUsed() : Date.now();
                    Profiler.record(config.name, endCpu - startCpu);
                }
            }
        }
    }
}

module.exports = { run: function colonyManager() {
    if (!global.State || !global.State.rooms) return;

    const executeWrapped = (name, fn) => {
        if (typeof fn === 'function') {
            wrap(name, wrapManager(fn, name))();
        }
    };

    // Phase 1: Global Trackers
    executeWrapped('ResourceTransferLedger.init', () => ResourceTransferLedger.init());
    executeWrapped('EnergyRequestManager.init', () => EnergyRequestManager.init && EnergyRequestManager.init());

    if (global.State && global.State.rooms && defconManager && typeof defconManager.run === 'function') {
        executeWrapped('defconManager.run', () => {
            for (const room of global.State.rooms.values()) defconManager.run(room);
        });
    }

    for (const room of global.State.rooms.values()) {
        if (room.controller && room.controller.my === true) {
            try {
                // Instantiate SpawnLedger globally for the room per tick
                const spawnLedger = new SpawnLedger(room);
                
                // Phase 2: Analysis & Planning
                executeWrapped('planner.run', () => planner.run(room));
                executeWrapped('rampartPlanner.run', () => rampartPlanner.run(room));
                executeWrapped('killboxPlanner.planKillboxes', () => killboxPlanner.planKillboxes(room));
                executeWrapped('BaseLayoutOptimizer.run', () => BaseLayoutOptimizer.run && BaseLayoutOptimizer.run(room));

                // Phase 3: Execution, Market & Logistics
                executeWrapped('MarketArbitrageAnalyzer.run', () => MarketArbitrageAnalyzer.run && MarketArbitrageAnalyzer.run(room));
                executeWrapped('MarketOrderAnalyzer.run', () => MarketOrderAnalyzer.run && MarketOrderAnalyzer.run(room));
                executeWrapped('MarketOrderExecutor.run', () => MarketOrderExecutor.run && MarketOrderExecutor.run(room));
                executeWrapped('TerminalManager.run', () => TerminalManager.run && TerminalManager.run(room));
                executeWrapped('defense.run', () => defense.run(room));
                executeWrapped('TowerManager.run', () => TowerManager.run && TowerManager.run(room));
                executeWrapped('RampartDefenseManager.run', () => RampartDefenseManager.run && RampartDefenseManager.run(room));
                executeWrapped('NukeEvacuationManager.run', () => NukeEvacuationManager.run && NukeEvacuationManager.run(room));
                executeWrapped('scavengingManager.run', () => scavengingManager.run(room));
                executeWrapped('logistics.run', () => logistics.run(room));
                executeWrapped('LogisticsManager.run', () => LogisticsManager.run(room));
                executeWrapped('labs.run', () => labs.run(room));
                executeWrapped('market.run', () => market.run(room));
                executeWrapped('haulerSizing.run', () => haulerSizing.run && haulerSizing.run(room));
                executeWrapped('SourceManager.run', () => {
                    if (typeof SourceManager.run === 'function') {
                        SourceManager.run(room);
                    } else {
                        const sources = SourceManager.getAvailableSources(room.name);
                        const harvesters = global.State.creepsByRoom.get(room.name)?.get('harvester') || [];
                        for (let i = 0; i < harvesters.length; i++) {
                            if (sources.length > 0 && !harvesters[i].heap.targetId) {
                                SourceManager.assignHarvester(sources[0].id, harvesters[i].id);
                            }
                        }
                    }
                });
                executeWrapped('workerManager.run', () => workerManager.run(room));
                executeWrapped('UpgraderManager.run', () => UpgraderManager.run && UpgraderManager.run(room));

                // LinkManager is handled centrally via managerOrchestrator but leaving un-wrapped here

                executeWrapped('RemoteEconomyManager.run', () => RemoteEconomyManager.run && RemoteEconomyManager.run(room));

                // Phase 4: Roles & Spawning
                executeWrapped('CreepRoleBalancer.run', () => CreepRoleBalancer.run && CreepRoleBalancer.run(room));
                executeWrapped('PreSpawnManager.run', () => PreSpawnManager.run(room));
                executeWrapped('SpawnEnergyReservations.run', () => SpawnEnergyReservations.run && SpawnEnergyReservations.run(room));
                executeWrapped('spawnManager.run', () => spawnManager.run(room, spawnLedger));
                executeWrapped('RCLProgressionManager.run', () => RCLProgressionManager.run(room));

                executeWrapped('MiningPlanner.planMiningSpots', () => {
                    if (Memory.rooms && Memory.rooms[room.name] && !Memory.rooms[room.name].miningSpots) {
                        MiningPlanner.planMiningSpots(room.name);
                    }
                });

                if (room.controller && room.controller.level >= 1 && room.controller.level <= 4) {
                    const sites = global.State.sitesByRoom.get(room.name);
                    const roomCreeps = global.State.creepsByRoom.get(room.name);
                    if (roomCreeps) {
                        const upgraders = roomCreeps.get('upgrader');
                        if (upgraders) {
                            const hasSites = sites && sites.length > 0;
                            for (let i = 0; i < upgraders.length; i++) {
                                if (!upgraders[i].heap) upgraders[i].heap = {};
                                upgraders[i].heap.overrideTask = hasSites ? 'build' : undefined;
                            }
                        }
                    }
                }

            } catch (e) {
                console.log(`[ColonyManager Error] Room ${room.name}: ${e.stack}`);
            }
        }
    }

    executeWrapped('runRoomManagers', () => runRoomManagers());
} };