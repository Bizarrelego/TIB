const fs = require('fs');
let files = require('child_process').execSync('grep -rl "global.State =" src/').toString().trim().split('\n');
files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(/global\.State = \{\};/g, 'global.State = new Map();');
    fs.writeFileSync(file, content);
});
