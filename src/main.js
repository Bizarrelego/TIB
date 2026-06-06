/**
 * TIB - Top-Down V8-Optimized AI
 * Main Execution Pipeline
 */

// Core Managers
const GlobalStateScanner = require('./state/GlobalStateScanner');
const ColonyManager = require('./colonies/ColonyManager');
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
    MemoryCleanupManager.run(); // Integrates MemoryCleanupManager into main loop

    // 1. Global State Scanning
    GlobalStateScanner.run(); // Ensures GlobalStateScanner runs at start

    // Removed IntelManager.run() from here to maintain the "Eyes" single responsibility
    // and strictly adhere to Skeleton Top-Down Architecture Constraints.
    // IntelManager execution has been shifted inside GlobalStateScanner.

    // 2. Colony Management (Spawning & Task Assignment)
    ColonyManager.run();

    // 3. Intent Execution
    RoleExecutor.run(); // Ensures RoleExecutor is called for all active creeps

    // Profiler Reporting
    ProfilerUtility.report();

    // Logger
    Logger.run();

    // Profiler End
    ProfilerUtility.end();
};