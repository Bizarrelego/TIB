/**
 * Utility for identifying and prioritizing available energy sources.
 * Strictly reads from the global state without native polling.
 * @module EnergySourceUtility
 */

class EnergySourceUtility {
    /**
     * Finds and sorts dropped energy resources in a room by amount (highest first).
     * @param {Room|string} room - The room object or room name.
     * @returns {Resource[]} Array of dropped energy Resource objects.
     */
    static findAvailableDroppedEnergy(room) {
        const roomName = typeof room === 'string' ? room : room.name;
        const state = global.State && global.State.rooms ? (typeof global.State.rooms.get === 'function' ? global.State.rooms.get(roomName) : global.State.rooms[roomName]) : null;
        if (!state || !state.droppedEnergy) return [];

        const energyDrops = state.droppedEnergy.filter(drop =>
            drop.amount > 0 && drop.resourceType === RESOURCE_ENERGY
        );
        return energyDrops.sort((a, b) => b.amount - a.amount);
    }

    /**
     * Finds and sorts ruins and tombstones containing energy in a room by amount (highest first).
     * @param {Room|string} room - The room object or room name.
     * @returns {Array<Ruin|Tombstone>} Array of Ruin and Tombstone objects containing energy.
     */
    static findEnergyInRuinsAndTombstones(room) {
        const roomName = typeof room === 'string' ? room : room.name;
        const state = global.State && global.State.rooms ? (typeof global.State.rooms.get === 'function' ? global.State.rooms.get(roomName) : global.State.rooms[roomName]) : null;
        if (!state) return [];

        let targets = [];

        if (state.ruins) {
            const ruinsWithEnergy = state.ruins.filter(ruin =>
                ruin.store && ruin.store.getUsedCapacity(RESOURCE_ENERGY) > 0
            );
            targets = targets.concat(ruinsWithEnergy);
        }

        if (state.tombstones) {
            const tombstonesWithEnergy = state.tombstones.filter(tombstone =>
                tombstone.store && tombstone.store.getUsedCapacity(RESOURCE_ENERGY) > 0
            );
            targets = targets.concat(tombstonesWithEnergy);
        }

        return targets.sort((a, b) =>
            b.store.getUsedCapacity(RESOURCE_ENERGY) - a.store.getUsedCapacity(RESOURCE_ENERGY)
        );
    }

    /**
     * Finds harvestable sources in a room (not depleted, or regenerating).
     * @param {Room|string} room - The room object or room name.
     * @returns {Source[]} Array of harvestable Source objects.
     */
    static findHarvestableSources(room) {
        const roomName = typeof room === 'string' ? room : room.name;
        const state = global.State && global.State.rooms ? (typeof global.State.rooms.get === 'function' ? global.State.rooms.get(roomName) : global.State.rooms[roomName]) : null;
        if (!state || !state.sources) return [];

        return state.sources.filter(source =>
            source.energy > 0 || source.ticksToRegeneration > 0
        );
    }
}

module.exports = EnergySourceUtility;
