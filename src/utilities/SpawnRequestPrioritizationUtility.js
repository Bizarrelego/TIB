/**
 * Utility for determining the highest priority creep spawn request in the queue.
 */
class SpawnRequestPrioritizationUtility {
    /**
     * Gets the highest priority spawn request from the provided queue.
     * Prioritizes roles for RCL 1-2 bootstrapping: harvester > hauler > upgrader > builder.
     *
     * @param {Array<Object>} spawnQueue - The current spawn queue.
     * @returns {Object|null} The highest priority request, or null if the queue is empty.
     */
    static getPrioritizedSpawnRequest(spawnQueue) {
        if (!spawnQueue || spawnQueue.length === 0) {
            return null;
        }

        const rolePriorities = {
            'harvester': 1,
            'hauler': 2,
            'upgrader': 3,
            'builder': 4
        };

        let highestPriorityRequest = null;
        let highestPriorityValue = Infinity;

        for (const request of spawnQueue) {
            const role = request.role;
            const priority = rolePriorities[role] !== undefined ? rolePriorities[role] : 99;

            if (priority < highestPriorityValue) {
                highestPriorityValue = priority;
                highestPriorityRequest = request;
            }
        }

        return highestPriorityRequest;
    }
}

module.exports = SpawnRequestPrioritizationUtility;
