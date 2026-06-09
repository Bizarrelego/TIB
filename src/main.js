/**
 * TIB - Top-Down V8-Optimized AI
 * Main Execution Pipeline
 */

// Core Managers
const GlobalStateScanner = require('./state/GlobalStateScanner'); // Ensure GlobalStateScanner is imported
const RoomStateScanner = require('./state/RoomStateScanner');
const SpawnManager = require('./colonies/SpawnManager');
const TaskAssignmentManager = require('./managers/TaskAssignmentManager');
const RoleExecutor = require('./managers/RoleExecutor');
const MemoryCleanupManager = require('./managers/MemoryCleanupManager');
const IntelManager = require('./managers/IntelManager');
const TrafficManager = require('./managers/TrafficManager');

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

    // 4. Task Assignment
    ErrorHandlingUtility.wrap(() => TaskAssignmentManager.run(), 'TaskAssignmentManager')();

    // 5. Spawning
    ErrorHandlingUtility.wrap(() => {
        for (const spawnName in Game.spawns) {
            SpawnManager.run(Game.spawns[spawnName]);
        }
    }, 'SpawnManager')();

    // 6. Intent Execution
    ErrorHandlingUtility.wrap(() => RoleExecutor.run(), 'RoleExecutor')();

    // 7. Traffic Management (resolves collisions and executes bulk move API calls)
    ErrorHandlingUtility.wrap(() => TrafficManager.run(), 'TrafficManager')();

    // Profiler Reporting
    ProfilerUtility.report();

    // Logger
    Logger.run();

    // Profiler End
    ProfilerUtility.end();
};