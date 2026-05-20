const fs = require('fs');
let content = fs.readFileSync('src/main.js', 'utf8');

// Replace the manual OSInitializer and phases 2-6 with orchestrator calls
content = content.replace(
    /executeManager\('OSInitializer', \(\) => OSInitializer\.init\(\)\);\s*\/\/ TrafficManager setup before intents are registered\s*executeManager\('trafficManager\.setup', \(\) => \{\s*if \(trafficManager && trafficManager\.setup\) trafficManager\.setup\(\);\s*\}\);/,
    "// Phase 1 initialization happens within managerOrchestrator\n    managerOrchestrator.init();"
);

content = content.replace(
    /managerOrchestrator\.runPhase\(2, throttlerFlags\);\s*managerOrchestrator\.runPhase\(3, throttlerFlags\);\s*managerOrchestrator\.runPhase\(4, throttlerFlags\);\s*managerOrchestrator\.runPhase\(5, throttlerFlags\);\s*managerOrchestrator\.runPhase\(6, throttlerFlags\);/,
    "managerOrchestrator.run(throttlerFlags);"
);

fs.writeFileSync('src/main.js', content);
console.log("Patched main.js");
