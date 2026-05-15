const SpawnLedger = require('./spawnLedger');
const spawnManager = require('./spawnManager');
const planner = require('./planner');
const worker = require('../roles/worker');
const harvester = require('../roles/harvester');
const hauler = require('../roles/hauler');
const fastFiller = require('../roles/fastFiller');
const LogisticsManager = require('./logisticsManager');
const hubManager = require('../roles/hubManager');
const defense = require('./defense');
const labs = require('./labs');
const scout = require('../roles/scout');
const logistics = require('./logistics');
const market = require('./market');
const remoteHarvester = require('../roles/remoteHarvester');
const remoteHauler = require('../roles/remoteHauler');
const reserver = require('../roles/reserver');

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
                // Standalone managers (ConstructionManager, workerManager, StorageManager,
                // LinkManager, UpgraderManager, RemoteEconomyManager) are executed centrally
                // via managerOrchestrator.js. They have been removed from here to prevent duplicate execution.
                worker.run(room);
                harvester.run(room);
                LogisticsManager.run(room.name);
                hauler.run(room);
                fastFiller.run(room);
                hubManager.run(room);
                defense.run(room);
                labs.run(room);
                scout.run(room);
                logistics.run(room);
                market.run(room);
                remoteHarvester.run(room);
                remoteHauler.run(room);
                reserver.run(room);
            } catch (e) {
                console.log(`[ColonyManager Error] Room ${room.name}: ${e.stack}`);
            }
        }
    }
};
