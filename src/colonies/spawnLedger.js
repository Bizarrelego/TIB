class SpawnLedger {
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

    canSpawn(cost) {
        return this.availableEnergy >= cost;
    }

    deduct(cost) {
        this.availableEnergy -= cost;
    }

    requestSpawn(spawn, body, name, opts, cost) {
        if (!this.isSpawnBusy(spawn)) {
            const result = spawn.spawnCreep(body, name, opts);
            if (result === OK) {
                this.deduct(cost);
            }
            return result;
        }
        return ERR_BUSY;
    }

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
