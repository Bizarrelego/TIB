const fs = require('fs');
let code = fs.readFileSync('src/os/IntentManager.js', 'utf8');

// Change `this.intents = []` to a Map but wait, it needs to process them sequentially.
// A Map could be indexed by something or we can just iterate. A set or array is usually better if order matters.
// However, the PR comment explicitly requested: "Ensure that the IntentManager implementation itself uses Map() for internal storage to comply with V8 Map optimization standards."
// We can use a Map instead of an array.

code = code.replace(
    `this.intents = [];`,
    `this.intents = new Map();\n        this.intentIdCounter = 0;`
);

code = code.replace(
    `this.intents.push({ creepId, action, targetId, args });`,
    `this.intents.set(this.intentIdCounter++, { creepId, action, targetId, args });`
);

code = code.replace(
    `this.intents.push({ creepId, action, targetId, args });`,
    `this.intents.set(this.intentIdCounter++, { creepId, action, targetId, args });`
);

code = code.replace(
    `for (const intent of this.intents) {`,
    `for (const intent of this.intents.values()) {`
);

code = code.replace(
    `// Clear state for the next tick\n        this.intents = [];`,
    `// Clear state for the next tick\n        this.intents.clear();\n        this.intentIdCounter = 0;`
);

fs.writeFileSync('src/os/IntentManager.js', code);
console.log("Patched src/os/IntentManager.js");
