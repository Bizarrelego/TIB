/**
 * @file DroppedResourceManager.js
 * @description Manages dropped resources in rooms, prioritizing them for hauling and scavenging based on amount and decay.
 */

class DroppedResourceManager {
    /**
     * Gets a prioritized list of dropped resources in the specified room.
     * @param {string} roomName
     * @param {RoomPosition} [anchorPos] - Optional position to prioritize closer resources.
     * @returns {Array<{target: Resource, priority: number, amount: number}>}
     */
    static getPrioritizedDroppedResources(roomName, anchorPos) {
        if (!global.State || !global.State.droppedByRoom) return [];

        let dropped = global.State.droppedByRoom.get(roomName) || [];
        if (dropped instanceof Map) {
            dropped = Array.from(dropped.values());
        }

        const prioritized = [];

        for (let i = 0; i < dropped.length; i++) {
            const resource = dropped[i];

            // Only care about energy or unspecified resource types (legacy parsing support)
            if (resource.resourceType !== undefined && resource.resourceType !== RESOURCE_ENERGY) {
                continue;
            }

            const amount = resource.amount || 0;
            if (amount === 0) continue;

            let priority = 70; // Base priority

            if (amount > 500) {
                priority = 95;
            } else if (amount > 100) {
                priority = 90;
            } else if (amount > 50) {
                priority = 80;
            }

            // Decay priority
            if (resource.ticksToDecay && resource.ticksToDecay < 500 && amount > 50) {
                priority += 5; // Boost priority if decaying soon and worth picking up
            }

            // Location priority
            if (anchorPos && resource.pos) {
                const range = anchorPos.getRangeTo(resource.pos);
                if (range <= 10) {
                    priority += 3;
                } else if (range <= 25) {
                    priority += 1;
                }
            }

            prioritized.push({
                target: resource,
                priority: priority,
                amount: amount
            });
        }

        // Sort by priority descending, then by amount descending
        prioritized.sort((a, b) => {
            if (b.priority !== a.priority) {
                return b.priority - a.priority;
            }
            return b.amount - a.amount;
        });

        return prioritized;
    }
}

module.exports = DroppedResourceManager;