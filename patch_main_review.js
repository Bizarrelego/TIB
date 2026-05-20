const fs = require('fs');
let content = fs.readFileSync('src/main.js', 'utf8');

// The reviewer mentioned "By calling managerOrchestrator.run() (which loops through phases 1 to 6)
// at the *end* of the main.js loop block, Phase 1 (OS Init & Cache) is now executed *after*
// cpuThrottler.run() and managersIntegration.init()."
//
// In reality, OS Init must be phase 1 and must run BEFORE throttler and integration.
// But we want to call orchestrator.run() which loops 1..6.
//
// The correct execution flow is:
// 1. tick start (forecaster)
// 2. managerOrchestrator.init()
// 3. Phase 1 happens IMMEDIATELY (it used to be OSInitializer.init() + trafficManager.setup())
// 4. throttler
// 5. manager integration
// 6. Phase 2-6
//
// Since we are asked to have a unified `managerOrchestrator.run(throttlerFlags)` that loops 1..6,
// that implies `run()` should be the ONLY major call block.
// But throttler needs to happen after Phase 1 and before Phase 2.
// Alternatively, `managerOrchestrator.runPhase(1)` could be called explicitly, then throttler,
// then `managerOrchestrator.runPhase(2..6)`.
// But the acceptance criteria literally says: "main.js calls managerOrchestrator.run() to execute the 6-phase pipeline."
//
// Wait, if `cpuThrottler.run()` and `managersIntegration.init()` need to happen *between* phases,
// the simplest solution is to move cpuThrottler and managersIntegration INTO managerOrchestrator.
// Or, we pass a callback, or we just put the throttler and manager integration inside the orchestrator loop or init.

content = `const resetRecovery = require('./os/resetRecovery');
const globalState = require('./state/globalState');
const managersIntegration = require('./managers/index');
const managerOrchestrator = require('./managers/managerOrchestrator'); // Standalone Managers
const cpuThrottler = require('./os/cpuThrottler');
const Logger = require('./utils/logger');
const cpuBucketForecaster = require('./os/cpuBucketForecaster');
const { executeManager } = require('./utils/errorHandler');

module.exports.loop = function () {
    if (!Memory.os_installed && global.Cache) {
        global.Cache = undefined;
        global.State = undefined;
    }

    Logger.info(\`--- Starting Tick \${Game.time} ---\`);

    // Tick-level utilities
    executeManager('cpuBucketForecaster.update', () => cpuBucketForecaster.update());

    managerOrchestrator.init();

    // The single orchestrator call that handles all 6 phases.
    managerOrchestrator.run();

    // Profiler output
    const Profiler = require('./utils/profiler');
    executeManager('Profiler.report', () => Profiler.report());

    // Save caches state for reset recovery
    executeManager('resetRecovery.saveState', () => resetRecovery.saveState());
};
`;

fs.writeFileSync('src/main.js', content);

let orchContent = fs.readFileSync('src/managers/managerOrchestrator.js', 'utf8');

const runFunc = `function run(throttlerFlags = {}) {
    for (let phase = 1; phase <= 6; phase++) {
        module.exports.runPhase(phase, throttlerFlags);
    }
}`;

const newRunFunc = `const cpuThrottler = require('../os/cpuThrottler');
const managersIntegration = require('./index');

function run(externalThrottlerFlags = {}) {
    let throttlerFlags = externalThrottlerFlags;

    for (let phase = 1; phase <= 6; phase++) {
        module.exports.runPhase(phase, throttlerFlags);

        // After Phase 1 (OS Init & Cache) we have global state rehydrated.
        // We must calculate throttler flags and register all integration managers
        // before we continue to Phase 2 (Global State).
        if (phase === 1) {
            executeManager('cpuThrottler.run', () => {
                throttlerFlags = cpuThrottler.run() || {};
            });
            executeManager('managersIntegration.init', () => managersIntegration.init(registeredTopLevelManagers.globalState));
        }
    }
}`;

orchContent = orchContent.replace(runFunc, newRunFunc);

fs.writeFileSync('src/managers/managerOrchestrator.js', orchContent);
console.log("Patched main.js and orchestrator to execute correctly in order.");
