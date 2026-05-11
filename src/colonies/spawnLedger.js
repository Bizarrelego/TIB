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
}

module.exports = SpawnLedger;
