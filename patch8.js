const fs = require('fs');
const content = fs.readFileSync('src/traffic/trafficManager.js', 'utf8');

const replacement = `
                    const blockingCreepName = global.State.swapRegistry.get(creep.name);
                    const blockingCreep = global.State.creepLookup ? global.State.creepLookup.get(blockingCreepName) : Game.creeps[blockingCreepName];
`;

const regex = /                    const blockingCreepName = global\.State\.swapRegistry\.get\(creep\.name\);\n                    const blockingCreep = Game\.creeps\[blockingCreepName\];/;

const newContent = content.replace(regex, replacement);
fs.writeFileSync('src/traffic/trafficManager.js', newContent);
