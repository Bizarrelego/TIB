/**
 * @file sourceSleep.js
 * @description Utility to manage source sleeping to save CPU on empty sources.
 */

const sourceSleep = {
    /**
     * Checks if a source should be slept. If its energy is 0, sets its wakeTick.
     * Otherwise, if wakeTick has passed, wakes it up.
     * @param {Source|Mineral} source - The source or mineral object.
     * @returns {boolean} True if the source is sleeping, false otherwise.
     */
    isSleeping(source) {
        if (!source) return false;

        if (!global.State) global.State = {};
        if (!global.State.sourcesCache) global.State.sourcesCache = new Map();

        let sourceCache = global.State.sourcesCache.get(source.id);
        if (!sourceCache) {
            sourceCache = {};
            global.State.sourcesCache.set(source.id, sourceCache);
        }

        // If the source is empty, we must sleep it
        // Minerals have mineralAmount, Sources have energy
        const amount = source.energy !== undefined ? source.energy : source.mineralAmount;

        if (amount === 0) {
            if (!sourceCache.wakeTick) {
                sourceCache.wakeTick = Game.time + source.ticksToRegeneration;
            }
            return true;
        }

        // If it's not empty, check if we had a sleep timer
        if (sourceCache.wakeTick) {
            if (Game.time >= sourceCache.wakeTick) {
                // Wake up time has come and passed
                delete sourceCache.wakeTick;
                return false;
            } else {
                // Still sleeping
                return true;
            }
        }

        return false;
    }
};

module.exports = sourceSleep;
