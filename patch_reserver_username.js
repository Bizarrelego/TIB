const fs = require('fs');
let code = fs.readFileSync('src/roles/reserver.js', 'utf8');

code = code.replace(/const myName = 'jules';/g, "const myName = creep.owner.username;");

fs.writeFileSync('src/roles/reserver.js', code);
