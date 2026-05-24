/**
 * @file RCLProgressionManager.js
 * @description Manages RCL progression logic for colonies.
 */

const { wrapManager } = require('../utils/ManagerErrorBoundary');

const RCL4HubManager = require('./RCL4HubManager');

/**
 * Runs the RCL progression logic for a given room.
 * @param {Room} _room - The room to process.
 */
function run(_room) {
    if (_room.controller && _room.controller.my && _room.controller.level === 4) {
        RCL4HubManager.run(_room);
    }
}

module.exports = {
    run: wrapManager(run, 'RCLProgressionManager')
};
