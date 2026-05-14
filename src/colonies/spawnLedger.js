/**
 * @class SpawnLedger
 * @description Tracks energy reservations per tick to ensure multiple spawns in one room do not exceed room.energyAvailable.
 */
class SpawnLedger {
    /**
     * @param {Room} room The room to track energy for.
     */
    constructor(room) {
        this.availableEnergy = room.energyAvailable;
    }

    /**
     * Gets the currently available energy in the room.
     * @returns {number} The available energy.
     */
    getAvailableEnergy() {
        return this.availableEnergy;
    }

    /**
     * Checks if the given spawn is currently busy spawning a creep.
     * @param {StructureSpawn} spawn The spawn structure to check.
     * @returns {boolean} True if the spawn is busy, false otherwise.
     */
    isSpawnBusy(spawn) {
        return spawn.spawning !== null && spawn.spawning !== undefined;
    }

    /**
     * Checks if a spawn request can be afforded.
     * @param {number} cost The cost of the creep to spawn.
     * @returns {boolean} True if affordable.
     */
    canSpawn(cost) {
        return this.availableEnergy >= cost;
    }

    /**
     * Reserves energy cost from the ledger for the tick.
     * @param {number} amount The energy amount to reserve.
     */
    reserveEnergy(amount) {
        // Subtracts from this.availableEnergy so subsequent requests in the same tick know the remaining budget
        this.availableEnergy -= amount;
    }

    /**
     * Requests a spawn, reserving energy cost if successful.
     * @param {StructureSpawn} spawn The spawn structure to use.
     * @param {Array<string>} body The creep body array.
     * @param {string} name The creep name.
     * @param {Object} opts The spawn options.
     * @param {number} cost The cost of the creep.
     * @returns {number} The error code from spawnCreep.
     */
    requestSpawn(spawn, body, name, opts, cost) {
        if (!this.isSpawnBusy(spawn)) {
            const result = spawn.spawnCreep(body, name, opts);
            if (result === OK) {
                this.reserveEnergy(cost);
            }
            return result;
        }
        return ERR_BUSY;
    }

    /**
     * Checks if a minimum link network is present in the room.
     * @param {Room} room The room to check.
     * @returns {boolean} True if network exists.
     */
    isLinkNetworkPresent(room) {
        const structuresMap = global.State.structuresByRoom.get(room.name);
        if (structuresMap) {
            const links = structuresMap.get(STRUCTURE_LINK) || [];
            return links.length >= 2;
        }
        return false;
    }
}

module.exports = SpawnLedger;
