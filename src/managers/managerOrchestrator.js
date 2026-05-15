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
const CombatManager = require('./CombatManager');
const EnergyRequestManager = require('./EnergyRequestManager');

/**
 * Orchestrates the execution of standalone managers per room.
 */
function managerOrchestrator() {
    // CPU Throttling: Skip manager execution if bucket is too low
    if (Game.cpu.bucket < 500) return;

    for (const roomName in Game.rooms) {
        const room = Game.rooms[roomName];

        // Only run managers in controlled rooms
        if (!room.controller || !room.controller.my) continue;

        const managers = [
            ConstructionManager,
            LabManager,
            MarketManager,
            TerminalManager,
            UpgraderManager,
            StorageManager,
            LinkManager,
            RemoteEconomyManager,
            workerManager,
            CombatManager,
            EnergyRequestManager
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
