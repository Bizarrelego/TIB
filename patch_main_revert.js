const fs = require('fs');
let content = fs.readFileSync('src/main.js', 'utf8');

content = content.replace(
    /if \(!global\.State\.get\("intentManager"\)\) \{/,
    'if (!global.State.intentManager) {'
);

content = content.replace(
    /global\.State\.set\("intentManager", new IntentManager\(\)\);/,
    'global.State.intentManager = new IntentManager();'
);

content = content.replace(
    /if \(global\.State && global\.State\.get\("intentManager"\)\) \{/,
    'if (global.State && global.State.intentManager) {'
);

content = content.replace(
    /global\.State\.get\("intentManager"\)\.executeIntents\(\);/,
    'global.State.intentManager.executeIntents();'
);

fs.writeFileSync('src/main.js', content);
