const MarketManager = require('../managers/MarketManager');
const TerminalManager = require('../managers/TerminalManager');

/**
 * Orchestrates phase 7 Market and Terminal logic.
 */
class MarketColonyManager {
    /**
     * Entry point called from the colonyManager loop.
     * @param {Room} room - The room object.
     */
    static run(room) {
        if (!room || !room.controller || !room.controller.my) return;

        try {
            // Internal logistics (Terminal-to-Terminal)
            TerminalManager.run(room);

            // Global trade (Terminal-to-Market)
            MarketManager.run(room);
        } catch (e) {
            console.log(`[MarketColonyManager Error] Room ${room.name}: ${e.stack}`);
        }
    }
}

module.exports = MarketColonyManager;
