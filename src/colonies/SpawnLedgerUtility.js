/**
 * @file SpawnLedgerUtility.js
 * @description Utility module providing a clean interface for managers to interact with spawn ledgers.
 * Encapsulates the logic for reserving energy for creeps and checking available capacity, preventing
 * direct manipulation of ledger internals.
 */

const SpawnEnergyReservations = require('./SpawnEnergyReservations');

/**
 * @class SpawnLedgerUtility
 * @description Provides a centralized interface for interactions with spawn capacity and tick ledgers.
 */
class SpawnLedgerUtility {
    /**
     * Gets the currently available virtual spawn energy.
     * Evaluated against the room's energyCapacityAvailable.
     * @param {string} roomName The name of the room.
     * @returns {number} Available virtual spawn energy.
     */
    static getAvailableSpawnEnergy(roomName) {
        const room = Game.rooms[roomName];
        if (!room) return 0;
        return SpawnEnergyReservations.getAvailableEnergy(roomName, room.energyCapacityAvailable);
    }

    /**
     * Reserves an amount of virtual energy against the room capacity.
     * @param {string} roomName The name of the room.
     * @param {number} bodyCost The cost to reserve.
     */
    static reserveEnergy(roomName, bodyCost) {
        SpawnEnergyReservations.reserveEnergy(roomName, bodyCost);
    }

    /**
     * Releases an amount of virtual energy previously reserved.
     * @param {string} roomName The name of the room.
     * @param {number} bodyCost The cost to release.
     */
    static releaseEnergy(roomName, bodyCost) {
        SpawnEnergyReservations.releaseEnergy(roomName, bodyCost);
    }

    /**
     * Checks if the spawnLedger (tick-specific actual energy tracker) can afford a given cost.
     * @param {Object} spawnLedger The spawnLedger instance for the room.
     * @param {number} cost The energy cost of the requested spawn.
     * @returns {boolean} True if the cost can be afforded.
     */
    static canAffordSpawn(spawnLedger, cost) {
        if (!spawnLedger) return false;
        return spawnLedger.canSpawn(cost);
    }

    /**
     * Requests the actual spawning of a creep through the spawnLedger.
     * @param {Object} spawnLedger The spawnLedger instance for the room.
     * @param {StructureSpawn} spawn The spawn structure to use.
     * @param {Array<string>} body The body part array.
     * @param {string} name The name of the creep.
     * @param {Object} opts Spawn options.
     * @param {number} cost The cost of the creep.
     * @returns {number} Execution code (e.g., OK, ERR_BUSY).
     */
    static executeSpawn(spawnLedger, spawn, body, name, opts, cost) {
        if (!spawnLedger) return ERR_INVALID_ARGS;
        return spawnLedger.requestSpawn(spawn, body, name, opts, cost);
    }

    /**
     * Checks if the given spawn is currently busy.
     * @param {Object} spawnLedger The spawnLedger instance for the room.
     * @param {StructureSpawn} spawn The spawn structure to check.
     * @returns {boolean} True if busy.
     */
    static isSpawnBusy(spawnLedger, spawn) {
        if (!spawnLedger) return true;
        return spawnLedger.isSpawnBusy(spawn);
    }
}

module.exports = SpawnLedgerUtility;
