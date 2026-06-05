/**
 * TIB - Top-Down V8-Optimized AI
 * Main Execution Pipeline
 */

// Core Managers
const GlobalStateScanner = require('./state/GlobalStateScanner');
const SpawnManager = require('./colonies/SpawnManager');
const TaskAssignmentManager = require('./managers/TaskAssignmentManager');
const RoleExecutor = require('./managers/RoleExecutor');

// Utilities
const MemoryCleanupManager = require('./managers/MemoryCleanupManager');
const ProfilerUtility = require('./utilities/ProfilerUtility');
const Logger = require('./utilities/Logger');

module.exports.loop = function () {
    // Profiler Start
    ProfilerUtility.start();

    // Memory Cleanup
    // Improvement: Clean dead memory first to prevent iteration over dead entities
    MemoryCleanupManager.run();

    // 1. Global State Scanning
    GlobalStateScanner.run();

    // 2. Colony Spawning
    SpawnManager.run();

    // 3. Task Assignment
    TaskAssignmentManager.run();

    // 4. Intent Execution
    RoleExecutor.run();

    // Profiler Reporting
    ProfilerUtility.report();

    // Logger
    Logger.run();

    // Profiler End
    ProfilerUtility.end();
};