const SpawnLedger = require('./spawnLedger');
const spawnManager = require('./spawnManager');

module.exports = function colonyManager() {
    for (const room of Object.values(Game.rooms)) {
        if (room.controller && room.controller.my === true) {
            try {
                const spawnLedger = new SpawnLedger(room);
                spawnManager.run(room, spawnLedger);
            } catch (e) {
                console.log(`[ColonyManager Error] Room ${room.name}: ${e.stack}`);
            }
        }
    }
};
