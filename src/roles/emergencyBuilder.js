/**
 * @file emergencyBuilder.js
 * @description Ignores all standard logic. Mines nearest node, directly refills spawn.
 */


module.exports = {
    /**
     * Executes logic for emergencyBuilder role.
     * @param {Room} room
     */
    run(room) {
        const roomCreeps = global.State.creepsByRoom.get(room.name);
        if (!roomCreeps) return;

        const emergencyBuilders = roomCreeps.get('emergencyBuilder');
        if (!emergencyBuilders || emergencyBuilders.length === 0) return;

        for (const creep of emergencyBuilders) {
            try {
                if (creep.fatigue > 0) continue; // Fatigue gating

                // Implementation placeholder
            } catch (e) {
                console.log(`[emergencyBuilder Error] Room ${room.name}, Creep ${creep.name}: ${e.stack}`);
            }
        }
    }
};
