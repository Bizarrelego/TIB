const fs = require('fs');
const content = fs.readFileSync('src/traffic/trafficManager.js', 'utf8');

const replacement = `
            for (const [creepName, intent] of global.State.trafficIntents.entries()) {
                const { creep, targetPos, opts, originalPos } = intent;
                if (!creep || !targetPos) continue;

                let intendedNextPos = null;
                const dx = Math.abs(creep.pos.x - targetPos.x);
                const dy = Math.abs(creep.pos.y - targetPos.y);

                if (dx <= 1 && dy <= 1 && creep.pos.roomName === targetPos.roomName) {
                    intendedNextPos = targetPos;
                } else if (creep.heap && creep.heap.path && creep.heap.path.length > 0) {
                    // Pull from pre-calculated CostMatrix path if available
                    intendedNextPos = creep.heap.path[0];
                } else {
                     // Provide default intendedNextPos to skip heavy PathFinder inside loop
                     // Since PathFinder is forbidden here.
                     continue;
                }
`;

const regex = /            for \(const \[creepName, intent\] of global\.State\.trafficIntents\.entries\(\)\) \{\n                const \{ creep, targetPos, opts, originalPos \} = intent;\n                if \(!creep \|\| !targetPos\) continue;\n\n                let intendedNextPos = null;\n                const dx = Math\.abs\(creep\.pos\.x - targetPos\.x\);\n                const dy = Math\.abs\(creep\.pos\.y - targetPos\.y\);\n\n                if \(dx <= 1 && dy <= 1 && creep\.pos\.roomName === targetPos\.roomName\) \{\n                    intendedNextPos = targetPos;\n                \} else \{\n                    const pathInfo = PathFinder\.search\(creep\.pos, \{ pos: targetPos, range: 1 \}, opts\);\n                    if \(pathInfo && pathInfo\.path && pathInfo\.path\.length > 0\) \{\n                        if \(!creep\.heap\) creep\.heap = \{\};\n                        creep\.heap\.path = pathInfo\.path;\n                        intendedNextPos = pathInfo\.path\[0\];\n                    \}\n                \}/;

const newContent = content.replace(regex, replacement);
fs.writeFileSync('src/traffic/trafficManager.js', newContent);
