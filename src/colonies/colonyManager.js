const SpawnLedger = require('./spawnLedger');
const spawnManager = require('./spawnManager');
const planner = require('./planner');
const economy = require('./economy');
const harvester = require('./harvester');
const StorageManager = require('../managers/StorageManager');
const LogisticsManager = require('../managers/LogisticsManager');

module.exports = function colonyManager() {
    for (const room of Object.values(Game.rooms)) {
        if (room.controller && room.controller.my === true) {
            try {
                const spawnLedger = new SpawnLedger(room);
                spawnManager.run(room, spawnLedger);
                StorageManager.run(room, spawnLedger);
                planner.run(room);
                economy.run(room);
                harvester.run(room);
                LogisticsManager.run(room, spawnLedger);
            } catch (e) {
                console.log(`[ColonyManager Error] Room ${room.name}: ${e.stack}`);
            }
        }
    }
};
