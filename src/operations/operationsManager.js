const { managers } = require('../managers/index');
const { PowerSpawnManager, QuadSquadManager } = managers;
const Profiler = require('../utils/profiler');
const { wrapModuleFunctions } = require('../utils/moduleWrapper');
const { executeManager } = require('../utils/errorHandler');
const intelManager = require('./intel');
const expansionManager = require('./expansion');
const offenseManager = require('./offense');
const scoutManager = require('./scoutManager');
const skOperationsManager = require('./skOperations');
const HarassmentManager = require('./HarassmentManager');
const powerBankManager = require('./powerBankManager');
const RemoteRoomProgressionManager = require('./RemoteRoomProgressionManager');

const RoleManager = require('../colonies/RoleManager');

/**
 * The main entry point for the Operations module, acting as a high-level orchestrator.
 * @returns {void}
 */
const exportedModule = Profiler.wrap('operationsManager', function operationsManager() {
    if (RoleManager && typeof RoleManager.runAll === 'function') {
        RoleManager.runAll();
    }
    intelManager();
        scoutManager();
        expansionManager();
        offenseManager();
        skOperationsManager();
        HarassmentManager();
        powerBankManager();
        RemoteRoomProgressionManager.run();

        if (global.State && global.State.rooms) {
            for (const room of global.State.rooms.values()) {
                PowerSpawnManager.run(room);
                QuadSquadManager.run(room);
            }
        }
});

module.exports = { run: wrapModuleFunctions(exportedModule, (funcName, originalFunc, ...args) => executeManager(`operationsManager.${funcName}`, originalFunc, ...args)) };
