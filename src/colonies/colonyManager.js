const SpawnLedger = require('./spawnLedger');
const spawnManager = require('./spawnManager');
const planner = require('./planner');
const defense = require('./defense');
const scavengingManager = require('./scavengingManager');

/**
 * Executes core colony management loop.
 * Instantiates the SpawnLedger to track energy use during the tick,
 * passing it as a singleton-like service to spawnManager.
 */
module.exports = function colonyManager() {
    for (const room of Object.values(Game.rooms)) {
        if (room.controller && room.controller.my === true) {
            // Instantiate SpawnLedger globally for the room per tick
            const spawnLedger = new SpawnLedger(room);
            spawnManager.run(room, spawnLedger);
            try {
                planner.run(room);
                defense.run(room);
                scavengingManager.run(room);

                // IMPROVEMENT: Removed all direct role executions (worker.run, hauler.run, etc.).
                // Reason: Consolidates execution hierarchy. Roles are now exclusively ticked via managerOrchestrator.js to respect tick-slicing and CPU bucket constraints.
            } catch (e) {
                console.log(`[ColonyManager Error] Room ${room.name}: ${e.stack}`);
            }
        }
    }
};
