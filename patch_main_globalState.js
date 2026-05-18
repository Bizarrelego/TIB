const fs = require('fs');

let content = fs.readFileSync('src/main.js', 'utf8');
content = content.replace(
    /if \(!global\.State\) \{\n\s*global\.State = new Map\(\);\n\s*\}/,
    'if (!global.State) {\n        global.State = {};\n    }'
);
fs.writeFileSync('src/main.js', content);
