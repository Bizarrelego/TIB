const fs = require('fs');
const filepath = 'src/constants/rolePriorities.js';
let content = fs.readFileSync(filepath, 'utf8');

content = content.replace("['remoteHauler', 85],", "['remoteHauler', 85],\n    ['powerHauler', 82],");
fs.writeFileSync(filepath, content);
