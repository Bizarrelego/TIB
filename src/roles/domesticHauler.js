/**
 * @file domesticHauler.js
 * @description Local source to Spawn/Ext transport. Retires when source Links deploy.
 */


module.exports = {
    /**
     * Executes logic for domesticHauler role.
     * @param {Room} room
     */
    run(room) {
        const roomCreeps = global.State.creepsByRoom.get(room.name);
        if (!roomCreeps) return;

        const domesticHaulers = roomCreeps.get('domesticHauler');
        if (!domesticHaulers || domesticHaulers.length === 0) return;

        for (const creep of domesticHaulers) {
            try {
                if (creep.fatigue > 0) continue; // Fatigue gating

                // Implementation placeholder
            } catch (e) {
                console.error(`[domesticHauler Error] Room ${room.name}, Creep ${creep.name}: ${e.stack}`);
            }
        }
    }
};
