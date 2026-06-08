/**
 * Utility for identifying and prioritizing targets for the withdraw action.
 * Strictly reads from the global state without native polling.
 * @module WithdrawTargetUtility
 */

class WithdrawTargetUtility {
    /**
     * Retrieves and prioritizes ruins and tombstones that contain energy.
     * @param {Object} roomState - The state object for the room.
     * @returns {RoomObject[]} Array of valid targets prioritized for scavenging.
     */
    static getScavengeTargets(roomState) {
        if (!roomState) return [];

        const targets = [];

        if (roomState.ruins) {
            for (let i = 0; i < roomState.ruins.length; i++) {
                const ruin = roomState.ruins[i];
                if (ruin && ruin.store && ruin.store.getUsedCapacity() > 0) {
                    targets.push(ruin);
                }
            }
        }

        if (roomState.tombstones) {
            for (let i = 0; i < roomState.tombstones.length; i++) {
                const tombstone = roomState.tombstones[i];
                if (tombstone && tombstone.store && tombstone.store.getUsedCapacity() > 0) {
                    targets.push(tombstone);
                }
            }
        }

        return targets;
    }
}

module.exports = WithdrawTargetUtility;
