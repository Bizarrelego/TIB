/**
 * TIB - Top-Down V8-Optimized AI
 * Main Execution Pipeline
 */

// Core Managers
const GlobalStateScanner = require('./state/GlobalStateScanner');
const IntelManager = require('./managers/IntelManager');
const RoomPlanner = require('./managers/RoomPlanner');
const SpawnManager = require('./colonies/SpawnManager');
const TaskAssignmentManager = require('./managers/TaskAssignmentManager');
const RoleExecutor = require('./managers/RoleExecutor');

// Utilities
const MemoryCleanupManager = require('./managers/MemoryCleanupManager');
const ProfilerUtility = require('./utilities/ProfilerUtility');
const Logger = require('./utilities/Logger');

module.exports.loop = function () {
    // 1. Profiler Start
    ProfilerUtility.start();

    // 2. Memory Cleanup
    // Improvement: Clean dead memory first to prevent iteration over dead entities
    MemoryCleanupManager.run();

    // 3. Global State Scanning
    GlobalStateScanner.run();

    // 4. Intelligence Gathering
    IntelManager.run();

    // 5. Room Planning
    RoomPlanner.run();

    // 6. Task Assignment
    TaskAssignmentManager.run();

    // 7. Colony Spawning
    SpawnManager.run();

    // 8. Intent Execution
    RoleExecutor.run();

    // 9. Profiler Reporting
    ProfilerUtility.report();

    // 10. Logger
    Logger.run();

    // 11. Profiler End
    ProfilerUtility.end();
};