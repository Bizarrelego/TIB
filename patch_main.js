const fs = require('fs');

let content = fs.readFileSync('src/main.js', 'utf8');

// The faulty code is:
// if (!global.State) {
//     global.State = {};
// }
// We need to replace it with:
// if (!global.State) {
//     global.State = new Map();
// }

content = content.replace(
    /if \(!global\.State\) \{\n\s*global\.State = \{\};\n\s*\}/,
    'if (!global.State) {\n        global.State = new Map();\n    }'
);

fs.writeFileSync('src/main.js', content);
