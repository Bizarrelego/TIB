const Profiler = require('../utils/profiler');
const globalState = require('../state/globalState');
const Logger = require('../utils/logger');

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

        // Managers configuration for tick-slicing
        const managersConfig = [
            { name: 'NukeEvacuationManager', slice: 1 },
            { name: 'TowerManager', slice: 1 },
            { name: 'ConstructionManager', slice: 1 },
            { name: 'workerManager', slice: 1 },
            { name: 'LinkManager', slice: 1 },
            { name: 'UpgraderManager', slice: 1 },
            { name: 'StorageManager', slice: 1 },
            { name: 'LabManager', slice: 5 },
            { name: 'RemoteEconomyManager', slice: 5 },
            { name: 'MarketManager', slice: 10 },
            { name: 'TerminalManager', slice: 10 }
        ];

        for (const config of managersConfig) {
            if (Game.time % config.slice !== 0) continue;

            const manager = globalState.getManager(config.name);
            if (manager && typeof manager.run === 'function') {
                Logger.debug(`Running manager ${config.name} in room ${room.name}`);
                const cpuAvailable = typeof Game !== 'undefined' && Game.cpu && typeof Game.cpu.getUsed === 'function';
                const startCpu = cpuAvailable ? Game.cpu.getUsed() : Date.now();
                try {
                    manager.run(room);
                } catch (e) {
                    Logger.error(`[ManagerOrchestrator Error] ${config.name} in Room ${room.name}: ${e.stack}`);
                }
                const endCpu = cpuAvailable ? Game.cpu.getUsed() : Date.now();
                Profiler.record(config.name, endCpu - startCpu);
            }
        }
    }
}

module.exports = {
    run: Profiler.wrap('managerOrchestrator.run', managerOrchestrator)
};
