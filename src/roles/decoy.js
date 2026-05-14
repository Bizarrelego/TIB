/**
 * @file decoy.js
 * @description Parks on enemy sites to block builds. Kites defenders to waste CPU.
 */


module.exports = {
    /**
     * Executes logic for decoy role.
     * @param {Room} room
     */
    run(room) {
        const roomCreeps = global.State.creepsByRoom.get(room.name);
        if (!roomCreeps) return;

        const decoys = roomCreeps.get('decoy');
        if (!decoys || decoys.length === 0) return;

        for (const creep of decoys) {
            try {
                if (creep.fatigue > 0) continue; // Fatigue gating

                // Implementation placeholder
            } catch (e) {
                console.error(`[decoy Error] Room ${room.name}, Creep ${creep.name}: ${e.stack}`);
            }
        }
    }
};
