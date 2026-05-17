const fs = require('fs');

let spawnManager = fs.readFileSync('src/colonies/spawnManager.js', 'utf8');
spawnManager = spawnManager.replace(/const body = capacity >= 1300 \? \[CLAIM, CLAIM, MOVE, MOVE\] : \[CLAIM, MOVE\];/,
`const body = [CLAIM, MOVE];`);
fs.writeFileSync('src/colonies/spawnManager.js', spawnManager);
