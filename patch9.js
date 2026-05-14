const fs = require('fs');
const content = fs.readFileSync('src/traffic/trafficManager.js', 'utf8');

const replacement = `                const { creep, targetPos, originalPos } = intent;`;

const regex = /                const \{ creep, targetPos, opts, originalPos \} = intent;/;

const newContent = content.replace(regex, replacement);
fs.writeFileSync('src/traffic/trafficManager.js', newContent);
