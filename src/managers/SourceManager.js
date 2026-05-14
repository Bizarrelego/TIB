const Profiler = require('../utils/profiler');
const globalState = require('../state/globalState');

/**
 * @file SourceManager.js
 * @description Centralized Source & Energy Node Manager (Tigga-Style).
 * Tracks energy sources and mineral deposits, maintains their state,
 * and implements Source Sleep to prevent creeps from attempting to harvest empty sources.
 */

class SourceManager {
    /**
     * Checks if a source or mineral is asleep (empty and still regenerating).
     * @param {string} id - The ID of the source or mineral.
     * @returns {boolean} True if asleep, False otherwise.
     */
    static isSourceAsleep(id) {
        if (!globalState.sourceData) return false;
        const sourceData = globalState.sourceData.get(id);
        if (!sourceData) return false;

        return Game.time < sourceData.wakeTick;
    }

    /**
     * Scans known rooms to identify and track all FIND_SOURCES and FIND_MINERALS.
     * Updates their state in globalState.sourceData.
     */
    static run() {
        if (!globalState.sourceData) {
            globalState.sourceData = new Map();
        }

        if (!global.State || !global.State.scannedRooms) return;

        for (const roomName of global.State.scannedRooms) {
            // Track sources
            const sources = global.State.sourcesByRoom.get(roomName) || [];
            for (let i = 0; i < sources.length; i++) {
                const source = sources[i];
                let data = globalState.sourceData.get(source.id);

                if (!data) {
                    data = {
                        energy: source.energy,
                        ticksToRegeneration: source.ticksToRegeneration,
                        wakeTick: 0
                    };
                    globalState.sourceData.set(source.id, data);
                } else {
                    data.energy = source.energy;
                    data.ticksToRegeneration = source.ticksToRegeneration;
                }

                if (source.energy === 0) {
                    // Only update wakeTick if it hasn't been set for this regeneration cycle
                    const newWakeTick = Game.time + source.ticksToRegeneration;
                    if (data.wakeTick < Game.time) {
                        data.wakeTick = newWakeTick;
                    }
                }
            }

            // Track minerals
            const minerals = global.State.mineralsByRoom.get(roomName) || [];
            for (let i = 0; i < minerals.length; i++) {
                const mineral = minerals[i];
                let data = globalState.sourceData.get(mineral.id);

                if (!data) {
                    data = {
                        mineralAmount: mineral.mineralAmount,
                        ticksToRegeneration: mineral.ticksToRegeneration,
                        wakeTick: 0
                    };
                    globalState.sourceData.set(mineral.id, data);
                } else {
                    data.mineralAmount = mineral.mineralAmount;
                    data.ticksToRegeneration = mineral.ticksToRegeneration;
                }

                if (mineral.mineralAmount === 0) {
                    const newWakeTick = Game.time + mineral.ticksToRegeneration;
                    if (data.wakeTick < Game.time) {
                        data.wakeTick = newWakeTick;
                    }
                }
            }
        }
    }
}

module.exports = Profiler.wrap('SourceManager', SourceManager);
