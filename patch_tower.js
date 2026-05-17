const fs = require('fs');
let towerManager = fs.readFileSync('src/managers/TowerManager.js', 'utf8');

towerManager = towerManager.replace(/console\.log\(\`\[TowerManager Error\] Room \$\{room\.name\}: \$\{e\.stack\}\`\);\n    \}/,
`} catch (e) {
        console.log(\`[TowerManager Error] Room \${room.name}: \${e.stack}\`);
    }`);

fs.writeFileSync('src/managers/TowerManager.js', towerManager);
