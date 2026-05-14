const fs = require('fs');
const content = fs.readFileSync('src/traffic/trafficManager.js', 'utf8');

const regex = /const dx = blockingCreep\.pos\.x - creep\.pos\.x;\n\s*const dy = blockingCreep\.pos\.y - creep\.pos\.y;/;

const newContent = content.replace(regex, "");
fs.writeFileSync('src/traffic/trafficManager.js', newContent);
