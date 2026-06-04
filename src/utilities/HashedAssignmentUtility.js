class HashedAssignmentUtility {
    /**
     * Assigns a single target from a list based on a consistent hash of the creep's identifier.
     * This prevents swarming by ensuring the same creep consistently targets the same object
     * from a given list, distributing the load evenly.
     *
     * @param {string} creepId - The unique identifier of the creep.
     * @param {Array} targetList - An array of potential targets.
     * @returns {any} The selected target, or null if the list is invalid or empty.
     */
    static assignByHash(creepId, targetList) {
        if (!Array.isArray(targetList) || targetList.length === 0) {
            return null;
        }

        if (!creepId) {
            return targetList[0];
        }

        const idString = String(creepId);
        let hash = 0;

        for (let i = 0; i < idString.length; i++) {
            const char = idString.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash |= 0; // Convert to 32bit integer
        }

        // Use Math.abs to ensure positive index
        const index = Math.abs(hash) % targetList.length;

        return targetList[index];
    }
}

module.exports = HashedAssignmentUtility;
