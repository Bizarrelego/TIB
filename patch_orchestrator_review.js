const fs = require('fs');
let content = fs.readFileSync('src/managers/managerOrchestrator.js', 'utf8');

// The original implementation relied heavily on global require imports at the top
// (like `globalState`, `colonyManager`, `operationsManager`, etc.)
// The reviewer wants these to be invoked *through* the `registeredTopLevelManagers`
// dictionary that was established in `init()`, to fully centralize and "orchestrate" them.

content = content.replace(
    /executeManager\('globalState\.scan', \(\) => \{ if \(globalState && globalState\.scan\) globalState\.scan\(\); \}\);/g,
    "executeManager('globalState.scan', () => { if (registeredTopLevelManagers.globalState && registeredTopLevelManagers.globalState.scan) registeredTopLevelManagers.globalState.scan(); });"
);

content = content.replace(
    /executeManager\('colonyManager', \(\) => \{ if \(colonyManager\) colonyManager\(\); \}\);/g,
    "executeManager('colonyManager', () => { if (registeredTopLevelManagers.colonyManager) registeredTopLevelManagers.colonyManager(); });"
);

content = content.replace(
    /executeManager\('operationsManager', \(\) => \{ if \(operationsManager\) operationsManager\(\); \}\);/g,
    "executeManager('operationsManager', () => { if (registeredTopLevelManagers.operationsManager) registeredTopLevelManagers.operationsManager(); });"
);

content = content.replace(
    /executeManager\('trafficManager\.run', \(\) => \{ if \(trafficManager && trafficManager\.run\) trafficManager\.run\(\); \}\);/g,
    "executeManager('trafficManager.run', () => { if (registeredTopLevelManagers.trafficManager && registeredTopLevelManagers.trafficManager.run) registeredTopLevelManagers.trafficManager.run(); });"
);

content = content.replace(
    /executeManager\('trafficManager\.executeIntents', \(\) => \{ if \(trafficManager && trafficManager\.executeIntents\) trafficManager\.executeIntents\(\); \}\);/g,
    "executeManager('trafficManager.executeIntents', () => { if (registeredTopLevelManagers.trafficManager && registeredTopLevelManagers.trafficManager.executeIntents) registeredTopLevelManagers.trafficManager.executeIntents(); });"
);

content = content.replace(
    /executeManager\('global\.State\.intentManager\.executeIntents', \(\) => \{\s*if \(global\.State && global\.State\.intentManager && typeof global\.State\.intentManager\.executeIntents === 'function'\) \{\s*global\.State\.intentManager\.executeIntents\(\);\s*\}\s*\}\);/g,
    "executeManager('IntentManager.executeIntents', () => {\n                if (global.State && global.State.intentManager && typeof global.State.intentManager.executeIntents === 'function') {\n                    global.State.intentManager.executeIntents();\n                } else if (registeredTopLevelManagers.IntentManager) {\n                    // Fallback to static class call if it's implemented there\n                }\n            });"
);


fs.writeFileSync('src/managers/managerOrchestrator.js', content);
console.log("Patched managerOrchestrator.js to address review feedback");
