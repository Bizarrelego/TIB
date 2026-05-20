const fs = require('fs');
let content = fs.readFileSync('src/managers/managerOrchestrator.js', 'utf8');

// Replace the standard object with a Map for V8 optimization per review
content = content.replace(
    /const registeredTopLevelManagers = \{\};/,
    "const registeredTopLevelManagers = new Map();"
);

// Update init to use Map.set
content = content.replace(
    /function init\(\) \{\s*registeredTopLevelManagers\.OSInitializer = typeof OSInitializer !== 'undefined' \? OSInitializer : require\('\.\.\/os\/OSInitializer'\);\s*registeredTopLevelManagers\.globalState = typeof globalState !== 'undefined' \? globalState : require\('\.\.\/state\/globalState'\);\s*registeredTopLevelManagers\.colonyManager = typeof colonyManager !== 'undefined' \? colonyManager : require\('\.\.\/colonies\/colonyManager'\);\s*registeredTopLevelManagers\.operationsManager = typeof operationsManager !== 'undefined' \? operationsManager : require\('\.\.\/operations\/operationsManager'\);\s*registeredTopLevelManagers\.trafficManager = typeof trafficManager !== 'undefined' \? trafficManager : require\('\.\.\/traffic\/trafficManager'\);\s*registeredTopLevelManagers\.IntentManager = typeof IntentManager !== 'undefined' \? IntentManager : require\('\.\.\/os\/IntentManager'\);\s*\}/g,
    `function init() {
    registeredTopLevelManagers.set('OSInitializer', typeof OSInitializer !== 'undefined' ? OSInitializer : require('../os/OSInitializer'));
    registeredTopLevelManagers.set('globalState', typeof globalState !== 'undefined' ? globalState : require('../state/globalState'));
    registeredTopLevelManagers.set('colonyManager', typeof colonyManager !== 'undefined' ? colonyManager : require('../colonies/colonyManager'));
    registeredTopLevelManagers.set('operationsManager', typeof operationsManager !== 'undefined' ? operationsManager : require('../operations/operationsManager'));
    registeredTopLevelManagers.set('trafficManager', typeof trafficManager !== 'undefined' ? trafficManager : require('../traffic/trafficManager'));
    registeredTopLevelManagers.set('IntentManager', typeof IntentManager !== 'undefined' ? IntentManager : require('../os/IntentManager'));
}`
);

// Update managersIntegration call
content = content.replace(
    /executeManager\('managersIntegration\.init', \(\) => managersIntegration\.init\(registeredTopLevelManagers\.globalState\)\);/g,
    "executeManager('managersIntegration.init', () => managersIntegration.init(registeredTopLevelManagers.get('globalState')));"
);

// Update Phase 1 execution
content = content.replace(
    /executeManager\('OSInitializer', \(\) => \{\s*if \(registeredTopLevelManagers\.OSInitializer\) \{\s*registeredTopLevelManagers\.OSInitializer\.init\(\);\s*\}\s*\}\);/g,
    `executeManager('OSInitializer', () => {
                const osInit = registeredTopLevelManagers.get('OSInitializer');
                if (osInit) {
                    osInit.init();
                }
            });`
);

content = content.replace(
    /executeManager\('trafficManager\.setup', \(\) => \{\s*if \(registeredTopLevelManagers\.trafficManager && registeredTopLevelManagers\.trafficManager\.setup\) \{\s*registeredTopLevelManagers\.trafficManager\.setup\(\);\s*\}\s*\}\);/g,
    `executeManager('trafficManager.setup', () => {
                const trfMgr = registeredTopLevelManagers.get('trafficManager');
                if (trfMgr && trfMgr.setup) {
                    trfMgr.setup();
                }
            });`
);

// Update Phase 2 execution
content = content.replace(
    /executeManager\('globalState\.scan', \(\) => \{ if \(registeredTopLevelManagers\.globalState && registeredTopLevelManagers\.globalState\.scan\) registeredTopLevelManagers\.globalState\.scan\(\); \}\);/g,
    `executeManager('globalState.scan', () => {
                    const gState = registeredTopLevelManagers.get('globalState');
                    if (gState && gState.scan) gState.scan();
                });`
);

// Update Phase 3 execution
content = content.replace(
    /executeManager\('colonyManager', \(\) => \{ if \(registeredTopLevelManagers\.colonyManager\) registeredTopLevelManagers\.colonyManager\(\); \}\);/g,
    `executeManager('colonyManager', () => {
                    const colMgr = registeredTopLevelManagers.get('colonyManager');
                    if (colMgr) colMgr();
                });`
);

// Update Phase 4 execution
content = content.replace(
    /executeManager\('operationsManager', \(\) => \{ if \(registeredTopLevelManagers\.operationsManager\) registeredTopLevelManagers\.operationsManager\(\); \}\);/g,
    `executeManager('operationsManager', () => {
                    const opMgr = registeredTopLevelManagers.get('operationsManager');
                    if (opMgr) opMgr();
                });`
);

// Update Phase 5 execution
content = content.replace(
    /executeManager\('trafficManager\.run', \(\) => \{ if \(registeredTopLevelManagers\.trafficManager && registeredTopLevelManagers\.trafficManager\.run\) registeredTopLevelManagers\.trafficManager\.run\(\); \}\);/g,
    `executeManager('trafficManager.run', () => {
                const trfMgr = registeredTopLevelManagers.get('trafficManager');
                if (trfMgr && trfMgr.run) trfMgr.run();
            });`
);

// Update Phase 6 execution
content = content.replace(
    /executeManager\('trafficManager\.executeIntents', \(\) => \{ if \(registeredTopLevelManagers\.trafficManager && registeredTopLevelManagers\.trafficManager\.executeIntents\) registeredTopLevelManagers\.trafficManager\.executeIntents\(\); \}\);/g,
    `executeManager('trafficManager.executeIntents', () => {
                const trfMgr = registeredTopLevelManagers.get('trafficManager');
                if (trfMgr && trfMgr.executeIntents) trfMgr.executeIntents();
            });`
);

content = content.replace(
    /else if \(registeredTopLevelManagers\.IntentManager\) \{/g,
    "else if (registeredTopLevelManagers.get('IntentManager')) {"
);


fs.writeFileSync('src/managers/managerOrchestrator.js', content);
console.log("Patched orchestrator to use Map for performance optimization");
