const fs = require('fs');
const content = fs.readFileSync('src/traffic/trafficManager.js', 'utf8');

const replacement = `const DeadlockEngine = require('./deadlock');
const movement = require('../utils/movement');
const ROLE_PRIORITIES = require('../constants/rolePriorities');`;

const newContent = content.replace("const DeadlockEngine = require('./deadlock');", replacement);
fs.writeFileSync('src/traffic/trafficManager.js', newContent);
