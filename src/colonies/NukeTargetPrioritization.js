/**
 * @file NukeTargetPrioritization.js
 * @description Evaluates enemy rooms based on intel to identify high-value targets for the Nuker.
 */

class NukeTargetPrioritization {
    /**
     * @typedef {Object} NukeTarget
     * @property {string} roomName - The name of the potential target room.
     * @property {number} score - The calculated priority score for the room.
     */

    /**
     * Evaluates all known rooms in intel and returns a prioritized list of potential nuke targets.
     *
     * @returns {NukeTarget[]} A sorted list of targets, highest priority first.
     */
    static getPrioritizedTargets() {
        const targets = [];

        if (!global.State || !global.State.intel) {
            return targets;
        }

        for (const [roomName, intel] of global.State.intel.entries()) {
            if (!intel.hostile || !intel.owner) {
                continue; // Only target hostile owned rooms
            }

            let score = 0;

            // Base score off controller level
            score += (intel.level || 0) * 10;

            // Prioritize spawns heavily
            if (intel.spawnCount) {
                score += intel.spawnCount * 50;
            }

            // High value targets
            if (intel.hasTerminal) {
                score += 40;
            }

            if (intel.hasStorage) {
                score += 30;
            }

            if (intel.hasNuker) {
                score += 100; // Counter-nuke priority
            }

            // Labs indicate higher tech level and boost capacity
            if (intel.labCount) {
                score += intel.labCount * 5;
            }

            // Dense structure clusters have strategic impact
            if (intel.structureCount) {
                score += Math.min(intel.structureCount, 100); // Cap structure count impact
            }

            if (score > 0) {
                targets.push({ roomName, score });
            }
        }

        // Sort descending by score
        targets.sort((a, b) => b.score - a.score);

        return targets;
    }
}

module.exports = NukeTargetPrioritization;
