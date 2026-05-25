const { wrap } = require('../utils/ManagerExecutionWrapper');
const { wrapManager } = require('../utils/ManagerErrorBoundary');

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
const MarketArbitrageAnalyzer = require('./MarketArbitrageAnalyzer');
const MarketOrderAnalyzer = require('./MarketOrderAnalyzer');
const MarketOrderExecutor = require('./MarketOrderExecutor');
const RemoteHaulerOptimizer = require('./RemoteHaulerOptimizer');
const ResourceTransferLedger = require('./ResourceTransferLedger');
const RoleManager = require('./RoleManager');
const SpawnEnergyReservations = require('./SpawnEnergyReservations');
const earlyGameConstructionPlanner = require('./earlyGameConstructionPlanner');
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
module.exports = { run: function colonyManager() {
    if (!global.State || !global.State.rooms) return;

    const executeWrapped = (name, fn) => {
        if (typeof fn === 'function') {
            wrap(name, wrapManager(fn, name))();
        }
    };

    // Phase 1: Global Trackers
    executeWrapped('ResourceTransferLedger.init', () => ResourceTransferLedger.init());
    executeWrapped('RoleManager.runAll', () => RoleManager.runAll());

    for (const room of global.State.rooms.values()) {
        if (room.controller && room.controller.my === true) {
            try {
                // Instantiate SpawnLedger globally for the room per tick
                const spawnLedger = new SpawnLedger(room);
                
                // Phase 2: Analysis & Planning
                executeWrapped('defconManager.run', () => defconManager.run(room));
                executeWrapped('planner.run', () => planner.run(room));
                executeWrapped('rampartPlanner.run', () => rampartPlanner.run(room));
                executeWrapped('killboxPlanner.planKillboxes', () => killboxPlanner.planKillboxes(room));
                executeWrapped('BaseLayoutOptimizer.run', () => BaseLayoutOptimizer.run && BaseLayoutOptimizer.run(room));

                // Phase 3: Execution, Market & Logistics
                executeWrapped('MarketArbitrageAnalyzer.run', () => MarketArbitrageAnalyzer.run && MarketArbitrageAnalyzer.run(room));
                executeWrapped('MarketOrderAnalyzer.run', () => MarketOrderAnalyzer.run && MarketOrderAnalyzer.run(room));
                executeWrapped('MarketOrderExecutor.run', () => MarketOrderExecutor.run && MarketOrderExecutor.run(room));
                executeWrapped('defense.run', () => defense.run(room));
                executeWrapped('scavengingManager.run', () => scavengingManager.run(room));
                executeWrapped('logistics.run', () => logistics.run(room));
                executeWrapped('LogisticsManager.run', () => LogisticsManager.run(room));
                executeWrapped('labs.run', () => labs.run(room));
                executeWrapped('market.run', () => market.run(room));
                executeWrapped('haulerSizing.run', () => haulerSizing.run && haulerSizing.run(room));

                // Phase 4: Roles & Spawning
                executeWrapped('CreepRoleBalancer.run', () => CreepRoleBalancer.run && CreepRoleBalancer.run(room));
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
} };