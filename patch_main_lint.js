const fs = require('fs');
let content = fs.readFileSync('src/main.js', 'utf8');

content = content.replace("const trafficManager = require('./traffic/trafficManager');\n", "");
content = content.replace("const OSInitializer = require('./os/OSInitializer');\n", "");

fs.writeFileSync('src/main.js', content);
console.log("Patched main.js lint errors");
