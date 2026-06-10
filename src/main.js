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
const TrafficManager = require('./managers/TrafficManager');
const RoomPlanner = require('./managers/RoomPlanner');
const ConstructionManager = require('./managers/ConstructionManager');
const ScoutingManager = require('./managers/ScoutingManager');
const LinkManager = require('./managers/LinkManager');
const InfrastructureManager = require('./managers/InfrastructureManager');
const TowerManager = require('./managers/TowerManager');

const { ProfilerUtility, Logger, ErrorHandlingUtility, StressTestUtility } = require('./lib/SystemLib');

module.exports.loop = function () {
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

    // 3.5 Stress Test Injection
    ErrorHandlingUtility.wrap(() => StressTestUtility.run(), 'StressTestUtility')();

    // 3.8 Planning & Scouting
    ErrorHandlingUtility.wrap(() => {
        for (const roomName in Game.rooms) {
            const room = Game.rooms[roomName];
            if (room.controller && room.controller.my) {
                RoomPlanner.manageRoom(room);
            }
        }
        RoomPlanner.visualize();
    }, 'RoomPlanner')();
    ErrorHandlingUtility.wrap(() => ConstructionManager.run(), 'ConstructionManager')();
    ErrorHandlingUtility.wrap(() => ScoutingManager.run(), 'ScoutingManager')();

    // 4. Task Assignment
    ErrorHandlingUtility.wrap(() => TaskAssignmentManager.run(), 'TaskAssignmentManager')();

    // 4.5 Link Management
    ErrorHandlingUtility.wrap(() => LinkManager.run(), 'LinkManager')();

    // 4.8 Infrastructure Transition
    ErrorHandlingUtility.wrap(() => InfrastructureManager.run(), 'InfrastructureManager')();

    // 5. Spawning
    ErrorHandlingUtility.wrap(() => {
        for (const spawnName in Game.spawns) {
            SpawnManager.run(Game.spawns[spawnName]);
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
};