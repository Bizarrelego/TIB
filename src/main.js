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

    // 2. Global State Scanning
    GlobalStateScanner.run();

    const cpuNormal = Game.cpu.bucket > 500;

    if (cpuNormal) {
        // 3. Intelligence Gathering
        IntelManager.run();

        // 4. Room Planning
        if (Game.time % 100 === 0) {
            RoomPlanner.run();
        }
    }

    // 5. Task Assignment
    TaskAssignmentManager.run();

    // 6. Colony Spawning
    SpawnManager.run();

    // 7. Intent Execution
    RoleExecutor.run();

    // 8. Memory Cleanup
    // Improvement: Clean dead memory first to prevent iteration over dead entities
    MemoryCleanupManager.run();

    // 9. Profiler Reporting
    ProfilerUtility.report();

    // 10. Logger
    Logger.run();

    // 11. Profiler End
    ProfilerUtility.end();
};