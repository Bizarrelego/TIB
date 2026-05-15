const Profiler = require('../utils/profiler');

// Import Managers
const ConstructionManager = require('./ConstructionManager');
const LabManager = require('./LabManager');
const MarketManager = require('./MarketManager');
const TerminalManager = require('./TerminalManager');
const UpgraderManager = require('./UpgraderManager');
const StorageManager = require('./StorageManager');
const LinkManager = require('./LinkManager');
const RemoteEconomyManager = require('./RemoteEconomyManager');
const workerManager = require('./workerManager');

/**
 * @file managerOrchestrator.js
 * @description Centralized execution module for standalone room managers.
 * Implements CPU throttling and error isolation to safely execute manager logic
 * without blocking the main execution loop.
 */

/**
 * Orchestrates the execution of standalone managers per room.
 * Retrieves rooms safely from global.State.rooms to adhere to the Zero Native Polling constraint.
 * Skips execution entirely if the CPU bucket falls below 500.
 *
 * @returns {void}
 */
function managerOrchestrator() {
    // CPU Throttling: Skip manager execution if bucket is too low
    if (Game.cpu.bucket < 500) return;

    // Zero Native Polling: rely on global.State for room objects if available.
    // Ensure discoveryManager has populated global.State.rooms
    if (!global.State || !global.State.rooms) return;

    for (const roomName of global.State.rooms.keys()) {
        const room = global.State.rooms.get(roomName);

        // Only run managers in controlled rooms
        if (!room || !room.controller || !room.controller.my) continue;

        /** @type {Array<{run: function(Room): void, name?: string}>} */
        const managers = [
            ConstructionManager,
            LabManager,
            MarketManager,
            TerminalManager,
            UpgraderManager,
            StorageManager,
            LinkManager,
            RemoteEconomyManager,
            workerManager
        ];

        for (const manager of managers) {
            if (manager && typeof manager.run === 'function') {
                try {
                    manager.run(room);
                } catch (e) {
                    const managerName = manager.name || 'UnknownManager';
                    console.log(`[ManagerOrchestrator Error] ${managerName} in Room ${room.name}: ${e.stack}`);
                }
            }
        }
    }
}

module.exports = {
    run: Profiler.wrap('managerOrchestrator.run', managerOrchestrator)
};
