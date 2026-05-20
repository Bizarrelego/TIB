const fs = require('fs');
let content = fs.readFileSync('src/main.js', 'utf8');

content = content.replace("const globalState = require('./state/globalState');\n", "");
content = content.replace("const managersIntegration = require('./managers/index');\n", "");
content = content.replace("const cpuThrottler = require('./os/cpuThrottler');\n", "");

fs.writeFileSync('src/main.js', content);
console.log("Patched main.js lint errors again");
