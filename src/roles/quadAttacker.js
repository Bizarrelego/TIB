/**
 * @file quadAttacker.js
 * @description Atomic lockstep movement. Works with quadHealer.
 */


module.exports = {
    /**
     * Executes logic for quadAttacker role.
     * @param {Room} room
     */
    run(room) {
        const roomCreeps = global.State.creepsByRoom.get(room.name);
        if (!roomCreeps) return;

        const quadAttackers = roomCreeps.get('quadAttacker');
        if (!quadAttackers || quadAttackers.length === 0) return;

        for (const creep of quadAttackers) {
            try {
                if (creep.fatigue > 0) continue; // Fatigue gating

                // Implementation placeholder
            } catch (e) {
                console.error(`[quadAttacker Error] Room ${room.name}, Creep ${creep.name}: ${e.stack}`);
            }
        }
    }
};
