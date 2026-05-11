const SpawnLedger = require('./spawnLedger');
const spawnManager = require('./spawnManager');
const planner = require('./planner');
const economy = require('./economy');
const harvester = require('./harvester');
const hauler = require('./hauler');

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
            } catch (e) {
                console.log(`[ColonyManager Error] Room ${room.name}: ${e.stack}`);
            }
        }
    }
};
