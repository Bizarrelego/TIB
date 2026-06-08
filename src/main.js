/**
 * TIB - Top-Down V8-Optimized AI
 * Main Execution Pipeline
 */

// Core Managers
const GlobalStateScanner = require('./state/GlobalStateScanner');
const RoomStateScanner = require('./state/RoomStateScanner');
const SpawnManager = require('./colonies/SpawnManager');
const TaskAssignmentManager = require('./managers/TaskAssignmentManager');
const RoleExecutor = require('./managers/RoleExecutor');
const MemoryCleanupManager = require('./managers/MemoryCleanupManager');
const IntelManager = require('./managers/IntelManager');
const RoomPlanner = require('./managers/RoomPlanner');
const TowerManager = require('./managers/TowerManager');
const MilitaryManager = require('./managers/MilitaryManager');

// Utilities
const ProfilerUtility = require('./utilities/ProfilerUtility');
const Logger = require('./utilities/Logger');
const ErrorHandlingUtility = require('./utilities/ErrorHandlingUtility');

module.exports.loop = function () {
    // Profiler Start
    ProfilerUtility.start();

    // Memory Cleanup
    ErrorHandlingUtility.wrap(() => MemoryCleanupManager.run(), 'MemoryCleanupManager')();

    // 1. Global State Scanning
    ErrorHandlingUtility.wrap(() => GlobalStateScanner.run(), 'GlobalStateScanner')();

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

    // 4. Room Planning (generates and executes blueprints)
    ErrorHandlingUtility.wrap(() => RoomPlanner.run(), 'RoomPlanner')();

    // 5. Spawning
    ErrorHandlingUtility.wrap(() => {
        for (const spawnName in Game.spawns) {
            SpawnManager.run(Game.spawns[spawnName]);
        }
    }, 'SpawnManager')();

    // 6. Task Assignment
    ErrorHandlingUtility.wrap(() => TaskAssignmentManager.run(), 'TaskAssignmentManager')();

    // 7. Intent Execution
    ErrorHandlingUtility.wrap(() => RoleExecutor.run(), 'RoleExecutor')();

    // 8. Tower Defense & Support
    ErrorHandlingUtility.wrap(() => TowerManager.run(), 'TowerManager')();

    // 9. Military Command
    ErrorHandlingUtility.wrap(() => MilitaryManager.run(), 'MilitaryManager')();

    // 10. Visualizer
    ErrorHandlingUtility.wrap(() => RoomPlanner.visualize(), 'Visualizer')();

    // Profiler Reporting
    ProfilerUtility.report();

    // Logger
    Logger.run();

    // Profiler End
    ProfilerUtility.end();
};