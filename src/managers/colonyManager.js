const SpawnLedger = require('../colonies/spawnLedger');
const spawnManager = require('./spawnManager');
const planner = require('../colonies/planner');
const ConstructionManager = require('./ConstructionManager');
const workerManager = require('./workerManager');
const worker = require('../roles/worker');
const harvester = require('../roles/harvester');
const hauler = require('../roles/hauler');
const StorageManager = require('./StorageManager');
const fastFiller = require('../roles/fastFiller');
const LogisticsManager = require('./logisticsManager');
const LinkManager = require('./LinkManager');
const hubManager = require('../roles/hubManager');
const UpgraderManager = require('./UpgraderManager');
const defense = require('../colonies/defense');
const labs = require('../colonies/labs');
const scout = require('../roles/scout');
const logistics = require('../colonies/logistics');
const market = require('../colonies/market');
const RemoteEconomyManager = require('./RemoteEconomyManager');
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

            try {
                spawnManager.run(room, spawnLedger);
                planner.run(room);
                ConstructionManager.run(room);
                workerManager.run(room);
                worker.run(room);
                harvester.run(room);
                LogisticsManager.run(room.name);
                hauler.run(room);
                StorageManager.run(room);
                fastFiller.run(room);
                LinkManager.run(room);
                hubManager.run(room);
                UpgraderManager.run(room);
                defense.run(room);
                labs.run(room);
                scout.run(room);
                logistics.run(room);
                market.run(room);
                LogisticsManager.run(room.name);
                RemoteEconomyManager.run(room);
                remoteHarvester.run(room);
                remoteHauler.run(room);
                reserver.run(room);
            } catch (e) {
                console.log(`[ColonyManager Error] Room ${room.name}: ${e.stack}`);
            }
        }
    }
};
