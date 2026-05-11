class SpawnLedger {
    constructor(room) {
        this.availableEnergy = room.energyAvailable;
    }

    canSpawn(cost) {
        return this.availableEnergy >= cost;
    }

    deduct(cost) {
        this.availableEnergy -= cost;
    }

    requestSpawn(spawn, body, name, opts, cost) {
        if (!spawn.spawning) {
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
