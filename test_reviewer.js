const globalState = require('./src/state/globalState.js');
const managersIntegration = require('./src/managers/index.js');
managersIntegration.init(globalState);
const manager = globalState.getManager('ConstructionManager');
console.log('Manager is:', typeof manager);
