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

module.exports.loop = function () {
    // 1. Memory Cleanup
    MemoryCleanupManager.run();

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

    // 5. Colony Spawning
    const rooms = Object.keys(Game.rooms);
    for (let i = 0; i < rooms.length; i++) {
        const roomName = rooms[i];
        const room = Game.rooms[roomName];
        
        if (room.controller && room.controller.my) {
            SpawnManager.run(roomName);
        }
    }

    // 6. Task Assignment
    TaskAssignmentManager.run();

    // 7. Intent Execution
    RoleExecutor.run();
};