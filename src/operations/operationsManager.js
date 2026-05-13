const intelManager = require('./intel');
const expansionManager = require('./expansion');
const offenseManager = require('./offense');

module.exports = function operationsManager() {
    try {
        intelManager();
        expansionManager();
        offenseManager();
    } catch (e) {
        console.error(`[OperationsManager Main Error] ${e.stack}`);
    }
};
