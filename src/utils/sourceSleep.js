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

        if (!Memory.sources) {
            Memory.sources = {};
        }

        // Initialize Memory for the specific source if it doesn't exist
        if (!Memory.sources[source.id]) {
            Memory.sources[source.id] = {};
        }

        // If the source is empty, we must sleep it
        // Minerals have mineralAmount, Sources have energy
        const amount = source.energy !== undefined ? source.energy : source.mineralAmount;

        if (amount === 0) {
            if (!Memory.sources[source.id].wakeTick) {
                Memory.sources[source.id].wakeTick = Game.time + source.ticksToRegeneration;
            }
            return true;
        }

        // If it's not empty, check if we had a sleep timer
        if (Memory.sources[source.id].wakeTick) {
            if (Game.time >= Memory.sources[source.id].wakeTick) {
                // Wake up time has come and passed
                delete Memory.sources[source.id].wakeTick;
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
