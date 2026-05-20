const fs = require('fs');
const content = fs.readFileSync('src/managers/managerOrchestrator.js', 'utf8');

// Insert import for OSInitializer and IntentManager
let updated = content.replace(
    "const EventLogRadar = require('../os/eventLogRadar');",
    "const OSInitializer = require('../os/OSInitializer');\nconst IntentManager = require('../os/IntentManager');\nconst EventLogRadar = require('../os/eventLogRadar');"
);
// fallback for imports
if(updated === content) {
    updated = content.replace(
        "const eventLogRadar = require('../os/eventLogRadar');",
        "const OSInitializer = require('../os/OSInitializer');\nconst IntentManager = require('../os/IntentManager');\nconst eventLogRadar = require('../os/eventLogRadar');"
    );
}

// Ensure the imports are present
if (!updated.includes("const OSInitializer")) {
    updated = "const OSInitializer = require('../os/OSInitializer');\nconst IntentManager = require('../os/IntentManager');\n" + updated;
}

const runPhaseFunc = `function runPhase(phase, throttlerFlags = {}) {`;
const runPhaseReplace = `
const registeredTopLevelManagers = {};

function init() {
    registeredTopLevelManagers.OSInitializer = typeof OSInitializer !== 'undefined' ? OSInitializer : require('../os/OSInitializer');
    registeredTopLevelManagers.globalState = typeof globalState !== 'undefined' ? globalState : require('../state/globalState');
    registeredTopLevelManagers.colonyManager = typeof colonyManager !== 'undefined' ? colonyManager : require('../colonies/colonyManager');
    registeredTopLevelManagers.operationsManager = typeof operationsManager !== 'undefined' ? operationsManager : require('../operations/operationsManager');
    registeredTopLevelManagers.trafficManager = typeof trafficManager !== 'undefined' ? trafficManager : require('../traffic/trafficManager');
    registeredTopLevelManagers.IntentManager = typeof IntentManager !== 'undefined' ? IntentManager : require('../os/IntentManager');
}

function run(throttlerFlags = {}) {
    for (let phase = 1; phase <= 6; phase++) {
        module.exports.runPhase(phase, throttlerFlags);
    }
}

function runPhase(phase, throttlerFlags = {}) {`;

updated = updated.replace(runPhaseFunc, runPhaseReplace);

const phase1Case = `
        case 1:
            Logger.debug('Phase 1: OS Init & Cache');
            executeManager('OSInitializer', () => {
                if (registeredTopLevelManagers.OSInitializer) {
                    registeredTopLevelManagers.OSInitializer.init();
                }
            });
            executeManager('trafficManager.setup', () => {
                if (registeredTopLevelManagers.trafficManager && registeredTopLevelManagers.trafficManager.setup) {
                    registeredTopLevelManagers.trafficManager.setup();
                }
            });
            break;

        case 2:`;

updated = updated.replace("case 2:", phase1Case);

const exportsBlock = `module.exports = {
    runPhase: Profiler.wrap('managerOrchestrator.runPhase', runPhase),
    runRoomManagers // Exported for testing/mocking if needed
};`;

const newExportsBlock = `module.exports = {
    init,
    run: Profiler.wrap('managerOrchestrator.run', run),
    runPhase: Profiler.wrap('managerOrchestrator.runPhase', runPhase),
    runRoomManagers // Exported for testing/mocking if needed
};`;

updated = updated.replace(exportsBlock, newExportsBlock);

fs.writeFileSync('src/managers/managerOrchestrator.js', updated);
console.log("Patched managerOrchestrator.js");
