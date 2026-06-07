const SpawnQueueUtility = require('./SpawnQueueUtility');

/**
 * Utility for formatting and submitting creep spawn requests to the global spawn queue.
 */
class CreepSpawnRequestUtility {
    /**
     * Creates and enqueues a new spawn request.
     *
     * @param {string} roomName - The name of the room requesting the spawn.
     * @param {string} role - The role of the creep to spawn.
     * @param {Array<string>} bodyParts - The array of body part constants for the creep.
     * @param {Object} memory - Initial memory to assign to the creep.
     */
    static requestCreep(roomName, role, bodyParts, memory = {}) {
        if (!roomName || !role || !bodyParts || bodyParts.length === 0) {
            return false;
        }

        const requestMemory = new Map();
        if (memory) {
            for (const key in memory) {
                requestMemory.set(key, memory[key]);
            }
        }
        requestMemory.set('role', role);
        requestMemory.set('colony', roomName);
        requestMemory.set('room', roomName);

        const request = {
            roomName: roomName,
            role: role,
            bodyParts: bodyParts,
            memory: requestMemory
        };

        // Submit the formatted request to the centralized queue
        SpawnQueueUtility.enqueue(request);
        return true;
    }
}

module.exports = CreepSpawnRequestUtility;
