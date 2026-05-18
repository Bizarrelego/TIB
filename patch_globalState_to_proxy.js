const fs = require('fs');
const cp = require('child_process');

let files = cp.execSync('grep -rl "global.State = new Map();" src/').toString().trim().split('\n');

files.forEach(file => {
    if (file) {
        let content = fs.readFileSync(file, 'utf8');
        content = content.replace(/global\.State = new Map\(\);/g, 'global.State = new Map();'); // Just leaving it as new Map() is fine, Map instances CAN have properties assigned to them in JS (e.g. state.rooms = new Map() works).
        fs.writeFileSync(file, content);
    }
});
