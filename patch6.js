const fs = require('fs');
const content = fs.readFileSync('src/traffic/trafficManager.js', 'utf8');

const replacement = `
            const currentPositions = new Map();
            for (const roomName of global.State.scannedRooms || []) {
                const roomCreeps = global.State.creepsByRoom.get(roomName);
                if (roomCreeps) {
                    for (const roleCreeps of roomCreeps.values()) {
                        if (Array.isArray(roleCreeps)) {
                            for (const creep of roleCreeps) {
                                currentPositions.set(\`\${creep.pos.roomName}_\${creep.pos.x}_\${creep.pos.y}\`, creep.name);
                            }
                        }
                    }
                }
            }
`;

const regex = /            const currentPositions = new Map\(\);\n            if \(typeof Game !== 'undefined' && Game\.creeps\) \{\n                for \(const creepName in Game\.creeps\) \{\n                    const creep = Game\.creeps\[creepName\];\n                    currentPositions\.set\(`\$\{creep\.pos\.roomName\}_\$\{creep\.pos\.x\}_\$\{creep\.pos\.y\}`\, creepName\);\n                \}\n            \}/;

const newContent = content.replace(regex, replacement);
fs.writeFileSync('src/traffic/trafficManager.js', newContent);
