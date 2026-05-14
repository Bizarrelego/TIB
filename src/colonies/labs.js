/**
 * @file labs.js
 * @description Manages RCL 6-8 lab interactions.
 */

const LabManager = require('../managers/LabManager');
const labManagerRole = require('../roles/labManager');

module.exports = {
    /**
     * Runs lab logistics for a given room.
     * @param {Room} room
     */
    run(room) {
        try {
            if (room.controller && room.controller.level >= 6) {
                LabManager.run(room);
                labManagerRole.run(room);
            }
        } catch (e) {
            console.error(`[LabsManager Error] Room ${room.name}: ${e.stack}`);
        }
    }
};
