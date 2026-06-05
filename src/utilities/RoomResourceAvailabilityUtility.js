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
     * Returns the ID of the closest available energy source to a given position.
     * @param {RoomPosition} pos
     * @param {string} roomName
     * @returns {string|null}
     */
    static getClosestEnergySource(pos, roomName) {
        if (!pos) return null;
        if (!global.State || !global.State.rooms) return null;
        const state = global.State.rooms.get(roomName);
        if (!state) return null;

        const candidates = [];

        if (state.droppedEnergy) {
            for (let i = 0; i < state.droppedEnergy.length; i++) {
                if (state.droppedEnergy[i].amount > 0) {
                    candidates.push(state.droppedEnergy[i]);
                }
            }
        }

        if (state.ruins) {
            for (let i = 0; i < state.ruins.length; i++) {
                if (state.ruins[i].store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                    candidates.push(state.ruins[i]);
                }
            }
        }

        if (state.tombstones) {
            for (let i = 0; i < state.tombstones.length; i++) {
                if (state.tombstones[i].store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                    candidates.push(state.tombstones[i]);
                }
            }
        }

        if (state.sources) {
            for (let i = 0; i < state.sources.length; i++) {
                if (state.sources[i].energy > 0) {
                    candidates.push(state.sources[i]);
                }
            }
        }

        if (candidates.length === 0) return null;

        const closest = pos.findClosestByRange(candidates);
        return closest ? closest.id : null;
    }
}

module.exports = RoomResourceAvailabilityUtility;
