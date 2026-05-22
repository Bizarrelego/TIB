const { determineDefcon, DEFCON_BEHAVIOR } = require('../constants/defcon');
const Logger = require('../utils/logger');

/**
 * @file defconManager.js
 * @description Manages DEFCON state evaluation based on room threats like hostiles and nukes.
 */

module.exports = {
    /**
     * Evaluates room threats and updates the DEFCON level in memory.
     * @param {Room} room - The room object.
     */
    run(room) {
        try {
            // Determine defcon based on threats cached in global.State
            const defconLevel = determineDefcon(room.name);

            // Set the defcon level in room memory
            room.memory.defcon = defconLevel;

            // Apply system-wide behaviors based on defcon
            if (DEFCON_BEHAVIOR[defconLevel]) {
                const behaviors = DEFCON_BEHAVIOR[defconLevel];
                room.memory.haltUpgrades = behaviors.haltUpgrades;
                room.memory.emergencyFortify = behaviors.emergencyFortify;
                room.memory.restrictStorageOutflow = behaviors.restrictStorageOutflow;
            }
        } catch (e) {
            Logger.error(`[DefconManager Error] Room ${room.name}: ${e.stack}`);
        }
    },

    /**
     * Exposes a method for other systems to query the current DEFCON level.
     * @param {string} roomName - The name of the room.
     * @returns {number} The current DEFCON level.
     */
    getDefconLevel(roomName) {
        if (Game.rooms[roomName] && Game.rooms[roomName].memory && Game.rooms[roomName].memory.defcon) {
            return Game.rooms[roomName].memory.defcon;
        }
        return determineDefcon(roomName);
    }
};
