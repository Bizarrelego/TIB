/**
 * @class SpawnEnergyReservations
 * @description Manages virtual spawn energy reservations to prevent over-spawning by multiple managers.
 */
class SpawnEnergyReservations {
    /**
     * Initializes the reservation tracking Map if it doesn't exist.
     */
    static _ensureInitialized() {
        if (!global.State) {
            global.State = {};
        }
        if (!global.State.spawnReservations) {
            global.State.spawnReservations = new Map();
        }
    }

    /**
     * Reserves an amount of energy for a room.
     * @param {string} roomName The name of the room.
     * @param {number} amount The amount of energy to reserve.
     */
    static reserveEnergy(roomName, amount) {
        SpawnEnergyReservations._ensureInitialized();
        const current = global.State.spawnReservations.get(roomName) || 0;
        global.State.spawnReservations.set(roomName, current + amount);
    }

    /**
     * Releases an amount of reserved energy for a room.
     * @param {string} roomName The name of the room.
     * @param {number} amount The amount of energy to release.
     */
    static releaseEnergy(roomName, amount) {
        SpawnEnergyReservations._ensureInitialized();
        const current = global.State.spawnReservations.get(roomName) || 0;
        const updated = Math.max(0, current - amount);
        global.State.spawnReservations.set(roomName, updated);
    }

    /**
     * Commits a reservation (alias for releaseEnergy).
     * @param {string} roomName The name of the room.
     * @param {number} amount The amount of energy to commit.
     */
    static commitReservation(roomName, amount) {
        SpawnEnergyReservations.releaseEnergy(roomName, amount);
    }

    /**
     * Gets the current available energy in a room after accounting for reservations.
     * @param {string} roomName The name of the room.
     * @param {number} roomEnergyAvailable The actual energy available in the room.
     * @returns {number} The true available energy.
     */
    static getAvailableEnergy(roomName, roomEnergyAvailable) {
        SpawnEnergyReservations._ensureInitialized();
        const reserved = global.State.spawnReservations.get(roomName) || 0;
        return Math.max(0, roomEnergyAvailable - reserved);
    }
}

module.exports = SpawnEnergyReservations;
