const fs = require('fs');

let content = fs.readFileSync('src/main.js', 'utf8');

content = content.replace(
    /if \(!global\.State\.intentManager\) \{/,
    'if (!global.State.get("intentManager")) {'
);

content = content.replace(
    /global\.State\.intentManager = new IntentManager\(\);/,
    'global.State.set("intentManager", new IntentManager());'
);

content = content.replace(
    /if \(global\.State && global\.State\.intentManager\) \{/,
    'if (global.State && global.State.get("intentManager")) {'
);

content = content.replace(
    /global\.State\.intentManager\.executeIntents\(\);/,
    'global.State.get("intentManager").executeIntents();'
);

fs.writeFileSync('src/main.js', content);
