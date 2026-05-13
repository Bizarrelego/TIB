const SpawnLedger = require('./spawnLedger');
const spawnManager = require('./spawnManager');
const planner = require('./planner');
const economy = require('./economy');
const harvester = require('./harvester');
const hauler = require('./hauler');
const StorageManager = require('../managers/StorageManager');
const fastFiller = require('../roles/fastFiller');
const fastFillerManager = require('../managers/FastFillerManager');
const LinkManager = require('../managers/LinkManager');
const hubManager = require('../roles/hubManager');
const upgrader = require('../roles/upgrader');
const defense = require('./defense');
const labs = require('./labs');
const scout = require('../roles/scout');
const logistics = require('./logistics');

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
                economy.run(room);
                harvester.run(room);
                hauler.run(room);
                StorageManager.run(room);
                fastFillerManager.run(room);
                fastFiller.run(room);
                LinkManager.run(room);
                hubManager.run(room);
                upgrader.run(room);
                defense.run(room);
                labs.run(room);
                scout.run(room);
                logistics.run(room);
            } catch (e) {
                console.log(`[ColonyManager Error] Room ${room.name}: ${e.stack}`);
            }
        }
    }
};
