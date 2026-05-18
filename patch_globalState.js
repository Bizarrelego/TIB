// Wait, looking at src/state/globalState.js, `module.exports = new GlobalStateManager();`
// In src/main.js, `const globalState = require('./state/globalState');`
// But main.js has `if (!global.State) { global.State = {}; }`
