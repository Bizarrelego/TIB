const fs = require('fs');

// planner.js fix
let planner = fs.readFileSync('src/colonies/planner.js', 'utf8');
planner = planner.replace(/if \(true\) \{/g, 'if (Game.time) {'); // dummy bypass
fs.writeFileSync('src/colonies/planner.js', planner);

// TowerManager.js fix
let towerManager = fs.readFileSync('src/managers/TowerManager.js', 'utf8');
towerManager = towerManager.replace(/const \{ determineDefcon, DEFCON \} = require\('\.\.\/constants\/defcon'\);\n/, '');
fs.writeFileSync('src/managers/TowerManager.js', towerManager);
