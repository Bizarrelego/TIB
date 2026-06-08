/**
 * Utility module to calculate and assess the energy balance within a given room.
 * @module RoomEnergyBalanceUtility
 */
class RoomEnergyBalanceUtility {
    /**
     * Calculates the total energy available in the room from dropped resources, ruins, and tombstones.
     * @param {string} roomName
     * @returns {number}
     */
    static getAvailableEnergy(roomName) {
        if (!global.State || !global.State.rooms) return 0;
        const state = typeof global.State.rooms.get === 'function' ? global.State.rooms.get(roomName) : global.State.rooms[roomName];
        if (!state) return 0;

        let totalAvailable = 0;

        if (state.droppedEnergy) {
            for (let i = 0; i < state.droppedEnergy.length; i++) {
                totalAvailable += state.droppedEnergy[i].amount;
            }
        }

        if (state.ruins) {
            for (let i = 0; i < state.ruins.length; i++) {
                totalAvailable += state.ruins[i].store.getUsedCapacity(RESOURCE_ENERGY);
            }
        }

        if (state.tombstones) {
            for (let i = 0; i < state.tombstones.length; i++) {
                totalAvailable += state.tombstones[i].store.getUsedCapacity(RESOURCE_ENERGY);
            }
        }

        return totalAvailable;
    }

    /**
     * Calculates the total energy deficit in the room based on the needs of spawns, extensions, and upgraders.
     * @param {string} roomName
     * @returns {number}
     */
    static getEnergyDeficit(roomName) {
        if (!global.State || !global.State.rooms) return 0;
        const state = typeof global.State.rooms.get === 'function' ? global.State.rooms.get(roomName) : global.State.rooms[roomName];
        if (!state) return 0;

        let totalDeficit = 0;

        if (state.spawns) {
            for (let i = 0; i < state.spawns.length; i++) {
                totalDeficit += state.spawns[i].store.getFreeCapacity(RESOURCE_ENERGY);
            }
        }

        if (state.extensions) {
            for (let i = 0; i < state.extensions.length; i++) {
                totalDeficit += state.extensions[i].store.getFreeCapacity(RESOURCE_ENERGY);
            }
        }

        if (state.upgraders) {
            for (let i = 0; i < state.upgraders.length; i++) {
                totalDeficit += state.upgraders[i].store.getFreeCapacity(RESOURCE_ENERGY);
            }
        }

        return totalDeficit;
    }
}

module.exports = RoomEnergyBalanceUtility;
