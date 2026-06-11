/**
 * TIB - Top-Down V8-Optimized AI
 * Main Execution Pipeline
 */

// Core Managers
const GlobalStateScanner = require('./state/GlobalStateScanner'); // Ensure GlobalStateScanner is imported
const RoomStateScanner = require('./state/RoomStateScanner');
const SpawnManager = require('./colonies/SpawnManager');
const TaskAssignmentManager = require('./managers/TaskAssignmentManager');
const ActionExecutor = require('./managers/ActionExecutor');
const MemoryCleanupManager = require('./managers/MemoryCleanupManager');
const IntelManager = require('./managers/IntelManager');
const RemoteMiningManager = require('./managers/RemoteMiningManager');
const EmpireManager = require('./empire/EmpireManager');
const EmpireLogisticsManager = require('./empire/EmpireLogisticsManager');
const MarketManager = require('./empire/MarketManager');
const ExpansionManager = require('./empire/ExpansionManager');
const PowerManager = require('./empire/PowerManager');
const TrafficManager = require('./managers/TrafficManager');
const RoomPlanner = require('./managers/RoomPlanner');
const ConstructionManager = require('./managers/ConstructionManager');
const ScoutingManager = require('./managers/ScoutingManager');
const ScienceManager = require('./managers/ScienceManager');
const LinkManager = require('./managers/LinkManager');
const InfrastructureManager = require('./managers/InfrastructureManager');
const TowerManager = require('./managers/TowerManager');

const { ProfilerUtility, Logger, ErrorHandlingUtility, StressTestUtility } = require('./lib/SystemLib');

let _parsedMemory = null;
let _lastTime = 0;

module.exports.loop = function () {
    // 1. RawMemory Interceptor (CPU Hack)
    // Eliminates persistent JSON.parse() CPU overhead by caching the heap-memory binding across ticks.
    if (_lastTime && _parsedMemory && Game.time === _lastTime + 1) {
        delete global.Memory;
        global.Memory = _parsedMemory;
    } else {
        _parsedMemory = JSON.parse(RawMemory.get() || '{}');
        delete global.Memory;
        global.Memory = _parsedMemory;
    }
    _lastTime = Game.time;
    // Profiler Start
    ProfilerUtility.start();

    // Memory Cleanup
    ErrorHandlingUtility.wrap(() => MemoryCleanupManager.run(), 'MemoryCleanupManager')();

    // 1. Global State Scanning
    ErrorHandlingUtility.wrap(() => GlobalStateScanner.run(), 'GlobalStateScanner')(); // Ensure scanner runs first

    // 2. Room State Scanning for Owned Rooms
    ErrorHandlingUtility.wrap(() => {
        if (!global.State) global.State = { rooms: new Map() };
        for (const roomName in Game.rooms) {
            const room = Game.rooms[roomName];
            if (room.controller && room.controller.my) {
                RoomStateScanner.run(room);
            }
        }
    }, 'RoomStateScanner')();

    // 3. Intel Gathering (serializes visible room data to Memory)
    ErrorHandlingUtility.wrap(() => IntelManager.run(), 'IntelManager')();

    // 3.2 Empire-Level Operations
    ErrorHandlingUtility.wrap(() => RemoteMiningManager.run(), 'RemoteMiningManager')();
    ErrorHandlingUtility.wrap(() => EmpireManager.run(), 'EmpireManager')();
    ErrorHandlingUtility.wrap(() => EmpireLogisticsManager.run(), 'EmpireLogisticsManager')();
    ErrorHandlingUtility.wrap(() => MarketManager.run(), 'MarketManager')();
    ErrorHandlingUtility.wrap(() => ExpansionManager.run(), 'ExpansionManager')();
    ErrorHandlingUtility.wrap(() => PowerManager.run(), 'PowerManager')();

    // 3.5 Stress Test Injection
    ErrorHandlingUtility.wrap(() => StressTestUtility.run(), 'StressTestUtility')();

    // Establish CPU Gating and Colony Priority
    let coloniesArr = [];
    if (global.State && global.State.colonies) {
        coloniesArr = Array.from(global.State.colonies.values());
        // Sort by RCL (highest to lowest). If equal, prioritize by threat level (hostiles presence)
        coloniesArr.sort((a, b) => {
            const stateA = global.State.rooms.get(a.name);
            const stateB = global.State.rooms.get(b.name);
            const rclA = stateA && stateA.controller ? stateA.controller.level : 0;
            const rclB = stateB && stateB.controller ? stateB.controller.level : 0;
            if (rclB !== rclA) return rclB - rclA;
            
            const threatA = stateA && stateA.hostileCount > 0 ? 1 : 0;
            const threatB = stateB && stateB.hostileCount > 0 ? 1 : 0;
            return threatB - threatA;
        });
    }

    // 3.8 Planning & Scouting (Throttled)
    ErrorHandlingUtility.wrap(() => {
        for (const colony of coloniesArr) {
            // CPU Throttling: Skip non-critical operations for low-priority colonies if CPU is strained
            if (Game.cpu.getUsed() > Game.cpu.limit * 0.8 && coloniesArr.indexOf(colony) > 0) continue;

            const room = Game.rooms[colony.name];
            if (room && room.controller && room.controller.my) {
                RoomPlanner.manageRoom(room);
            }
        }
        RoomPlanner.visualize();
    }, 'RoomPlanner')();
    ErrorHandlingUtility.wrap(() => ConstructionManager.run(), 'ConstructionManager')();
    ErrorHandlingUtility.wrap(() => ScoutingManager.run(), 'ScoutingManager')();
    ErrorHandlingUtility.wrap(() => ScienceManager.run(), 'ScienceManager')();

    // 4. Task Assignment (Scoped by Colony, Throttled)
    ErrorHandlingUtility.wrap(() => {
        for (const colony of coloniesArr) {
            // CPU Throttling: Skip TaskAssignment for low-priority colonies if CPU is critically strained
            if (Game.cpu.getUsed() > Game.cpu.limit * 0.8 && coloniesArr.indexOf(colony) > 0) continue;
            TaskAssignmentManager.run(colony);
        }
    }, 'TaskAssignmentManager')();

    // 4.5 Link Management
    ErrorHandlingUtility.wrap(() => LinkManager.run(), 'LinkManager')();

    // 4.8 Infrastructure Transition
    ErrorHandlingUtility.wrap(() => InfrastructureManager.run(), 'InfrastructureManager')();

    // 5. Spawning
    ErrorHandlingUtility.wrap(() => {
        if (global.State && global.State.colonies) {
            for (const spawnName in Game.spawns) {
                const spawn = Game.spawns[spawnName];
                const colony = global.State.colonies.get(spawn.room.name);
                if (colony) {
                    SpawnManager.run(spawn, colony);
                }
            }
        }
    }, 'SpawnManager')();

    // 6. Intent Execution
    ErrorHandlingUtility.wrap(() => ActionExecutor.run(), 'ActionExecutor')();

    // 7. Traffic Management (resolves collisions and executes bulk move API calls)
    ErrorHandlingUtility.wrap(() => TrafficManager.run(), 'TrafficManager')();

    // 8. Tower Management (Defense, Healing, and Repair)
    ErrorHandlingUtility.wrap(() => TowerManager.run(), 'TowerManager')();

    // Profiler Reporting
    ProfilerUtility.report();

    // Logger
    Logger.run();

    // Profiler End
    ProfilerUtility.end();

    // Serialize RawMemory manually at end of tick
    RawMemory.set(JSON.stringify(global.Memory));
};