class RoomResourceAvailabilityUtility {
    /**
     * Sums energy from all relevant sources (dropped, ruins, tombstones, sources).
     * @param {string} roomName
     * @returns {number}
     */
    static getTotalEnergyAvailable(roomName) {
        if (!global.State || !global.State.rooms) return 0;
        const state = global.State.rooms.get(roomName);
        if (!state) return 0;

        let totalEnergy = 0;

        if (state.droppedEnergy) {
            for (let i = 0; i < state.droppedEnergy.length; i++) {
                totalEnergy += state.droppedEnergy[i].amount;
            }
        }

        if (state.ruins) {
            for (let i = 0; i < state.ruins.length; i++) {
                totalEnergy += state.ruins[i].store.getUsedCapacity(RESOURCE_ENERGY);
            }
        }

        if (state.tombstones) {
            for (let i = 0; i < state.tombstones.length; i++) {
                totalEnergy += state.tombstones[i].store.getUsedCapacity(RESOURCE_ENERGY);
            }
        }

        if (state.sources) {
            for (let i = 0; i < state.sources.length; i++) {
                totalEnergy += state.sources[i].energy;
            }
        }

        return totalEnergy;
    }

    /**
     * Returns the ID of the closest available energy source to a given position,
     * prioritizing Ruins/Tombstones over standard dropped energy, then sources.
     * Uses pure JS distance calculation to avoid native polling.
     * @param {RoomPosition} pos
     * @param {string} roomName
     * @returns {string|null}
     */
    static getClosestEnergySource(pos, roomName) {
        if (!pos) return null;
        if (!global.State || !global.State.rooms) return null;
        const state = global.State.rooms.get(roomName);
        if (!state) return null;

        const findClosestInArray = (array, conditionFn) => {
            if (!array || array.length === 0) return null;
            let closest = null;
            let minRange = Infinity;

            for (let i = 0; i < array.length; i++) {
                const element = array[i];
                if (!conditionFn(element)) continue;

                const range = pos.getRangeTo(element.pos);
                if (range < minRange) {
                    minRange = range;
                    closest = element;
                }
            }
            return closest;
        };

        // 1. Priority: Ruins & Tombstones
        let closestScavenge = null;
        let minScavengeRange = Infinity;

        const closestRuin = findClosestInArray(state.ruins, r => r.store.getUsedCapacity(RESOURCE_ENERGY) > 0);
        if (closestRuin) {
            const range = pos.getRangeTo(closestRuin.pos);
            if (range < minScavengeRange) {
                minScavengeRange = range;
                closestScavenge = closestRuin;
            }
        }

        const closestTombstone = findClosestInArray(state.tombstones, t => t.store.getUsedCapacity(RESOURCE_ENERGY) > 0);
        if (closestTombstone) {
            const range = pos.getRangeTo(closestTombstone.pos);
            if (range < minScavengeRange) {
                minScavengeRange = range;
                closestScavenge = closestTombstone;
            }
        }

        if (closestScavenge) return closestScavenge.id;

        // 2. Priority: Dropped Energy
        const closestDrop = findClosestInArray(state.droppedEnergy, d => d.amount > 0);
        if (closestDrop) return closestDrop.id;

        // 3. Priority: Sources
        const closestSource = findClosestInArray(state.sources, s => s.energy > 0);
        if (closestSource) return closestSource.id;

        return null;
    }
}

module.exports = RoomResourceAvailabilityUtility;
