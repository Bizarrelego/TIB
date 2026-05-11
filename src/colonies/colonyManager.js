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

module.exports = function colonyManager() {
    for (const room of Object.values(Game.rooms)) {
        if (room.controller && room.controller.my === true) {
            try {
                const spawnLedger = new SpawnLedger(room);
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
            } catch (e) {
                console.log(`[ColonyManager Error] Room ${room.name}: ${e.stack}`);
            }
        }
    }
};
