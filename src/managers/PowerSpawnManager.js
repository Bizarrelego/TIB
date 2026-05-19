/**
 * Handles the operation of STRUCTURE_POWER_SPAWN structures.
 * Responsible for deciding when to process power, managing power resources,
 * and triggering processPower() when conditions are met.
 */
class PowerSpawnManager {
    /**
     * Executes power spawn operations per room.
     * @param {Room} room - The room object.
     */
    static run(room) {
        if (!room.controller || room.controller.level < 8) return;
        if (Game.cpu.bucket < 2000) return; // CPU Throttling

        try {
            const structuresMap = global.State.structuresByRoom.get(room.name);
            if (!structuresMap) return;

            const powerSpawns = structuresMap.get(STRUCTURE_POWER_SPAWN) || [];
            if (powerSpawns.length === 0) return;

            const storage = room.storage;
            const terminal = room.terminal;

            let totalEnergy = 0;

            if (storage) {
                totalEnergy += storage.store.getUsedCapacity(RESOURCE_ENERGY);
            }

            if (terminal) {
                totalEnergy += terminal.store.getUsedCapacity(RESOURCE_ENERGY);
            }

            // Only process power if we have a healthy energy buffer (e.g. 300k) and available power
            const ENERGY_RESERVE_THRESHOLD = 300000;

            for (let i = 0; i < powerSpawns.length; i++) {
                const powerSpawn = powerSpawns[i];

                // If we don't have enough energy reserve, don't process
                if (totalEnergy < ENERGY_RESERVE_THRESHOLD) continue;

                // Process power if the spawn itself has the required resources
                if (powerSpawn.store.getUsedCapacity(RESOURCE_POWER) >= 1 && powerSpawn.store.getUsedCapacity(RESOURCE_ENERGY) >= 50) {
                    const result = powerSpawn.processPower();
                    if (result === OK) {
                        // Successfully processing power
                    }
                }
            }
        } catch (e) {
            console.log(`[PowerSpawnManager Error] Room ${room.name}: ${e.stack}`);
        }
    }
}

module.exports = PowerSpawnManager;
