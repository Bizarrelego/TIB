const fs = require('fs');
const content = fs.readFileSync('src/traffic/trafficManager.js', 'utf8');

const regex = /const DIRECTION_VECTORS = new Map\(\[\[1, \[0, -1\]\], \[2, \[1, -1\]\], \[3, \[1, 0\]\], \[4, \[1, 1\]\], \[5, \[0, 1\]\], \[6, \[-1, 1\]\], \[7, \[-1, 0\]\], \[8, \[-1, -1\]\]\]\);\n/;

const newContent = content.replace(regex, "");
fs.writeFileSync('src/traffic/trafficManager.js', newContent);
