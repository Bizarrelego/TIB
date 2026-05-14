const intelManager = require('../operations/intel');
const expansionManager = require('../operations/expansion');
const offenseManager = require('../operations/offense');
const scoutManager = require('./scoutManager');

module.exports = function operationsManager() {
    try {
        intelManager();
        scoutManager();
        expansionManager();
        offenseManager();
    } catch (e) {
        console.error(`[OperationsManager Main Error] ${e.stack}`);
    }
};
