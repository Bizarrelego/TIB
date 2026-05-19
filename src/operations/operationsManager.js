const Profiler = require('../utils/profiler');
const intelManager = require('./intel');
const expansionManager = require('./expansion');
const offenseManager = require('./offense');
const scoutManager = require('./scoutManager');
const skOperationsManager = require('./skOperations');
const HarassmentManager = require('./HarassmentManager');
const powerBankManager = require('./powerBankManager');
const PowerSpawnManager = require('../managers/PowerSpawnManager');

/**
 * The main entry point for the Operations module, acting as a high-level orchestrator.
 * @returns {void}
 */
module.exports = Profiler.wrap('operationsManager', function operationsManager() {
    try {
        intelManager();
        scoutManager();
        expansionManager();
        offenseManager();
        skOperationsManager();
        HarassmentManager();
        powerBankManager();

        if (global.State && global.State.rooms) {
            for (const room of global.State.rooms.values()) {
                PowerSpawnManager.run(room);
            }
        }
    } catch (e) {
        console.error(`[OperationsManager Main Error] ${e.stack}`);
    }
});
