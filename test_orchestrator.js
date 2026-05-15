const globalState = require('./src/state/globalState.js');
const managersIntegration = require('./src/managers/index.js');
managersIntegration.init(globalState);

const orchestrator = require('./src/managers/managerOrchestrator.js');

global.Game = { time: 10, cpu: { bucket: 5000 } };
global.State = {
    rooms: new Map([
        ['W1N1', { controller: { my: true }, name: 'W1N1' }]
    ]),
    sitesByRoom: new Map([['W1N1', []]]),
    structuresByRoom: new Map([['W1N1', new Map()]]),
    creepsByRoom: new Map([['W1N1', new Map()]])
};

orchestrator.run();
console.log('Orchestrator ran successfully');
