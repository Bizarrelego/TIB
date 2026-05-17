const fs = require('fs');
let content = fs.readFileSync('src/colonies/spawnManager.js', 'utf8');

content = content.replace(/\/\/ Spawn a worker to act as multi-purpose builder\/upgrader[\s\S]*?cost\);\n            \}/, '');

content = content.replace(/let desiredUpgraders = spawnLedger\.calculateUpgraderTarget\(room, harvesterCount\);\n        if \(room\.controller\.level >= 5\) \{[\s\S]*?cost\);\n            \}\n        \}/,
`let desiredUpgraders = spawnLedger.calculateUpgraderTarget(room, harvesterCount);
        if (room.controller.level >= 5) {
            desiredUpgraders = UpgraderManager.getDesiredCount(room);
        }

        if (upgraderCount < desiredUpgraders) {
            const body = BodyCalc.calculateUpgrader(capacity);
            const cost = BodyCalc.getCost(body);
            if (spawnLedger.canSpawn(cost)) {
                SpawnQueueManager.requestSpawn(room.name, 'upgrader', body, 'upgrader_' + Game.time, {
                    memory: { role: 'upgrader', colony: room.name }
                }, cost);
            }
        }`);

fs.writeFileSync('src/colonies/spawnManager.js', content);
