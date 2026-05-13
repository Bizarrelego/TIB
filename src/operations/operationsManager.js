const intelManager = require('./intel');
const expansionManager = require('./expansion');
const offenseManager = require('./offense');
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
