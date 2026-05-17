const fs = require('fs');

// Patch colonyManager.js
let colonyManager = fs.readFileSync('src/colonies/colonyManager.js', 'utf8');
colonyManager = colonyManager.replace(/\/\/ Multi-room OS Interrupt: Override Upgrader to Builder if sites exist\n        if \(state === 'upgrade' && sites\.length > 0\) \{\n            creep\.heap\.state = 'build';\n            creep\.heap\.targetId = sites\[0\]\.id;\n        \}/,
`// Multi-room OS Interrupt: Override Upgrader to Builder if sites exist
        if (state === 'upgrade' && sites.length > 0) {
            creep.heap.state = 'build';
            creep.heap.targetId = sites[0].id;
        } else if (state === 'build' && sites.length === 0) {
            creep.heap.state = 'upgrade';
        }`);
fs.writeFileSync('src/colonies/colonyManager.js', colonyManager);
