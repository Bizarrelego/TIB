/**
 * @file powerAttacker.js
 * @description Dedicated role for attacking power banks.
 */

module.exports = {
    /**
     * Executes logic for the powerAttacker role.
     * @param {Room} room - The room in which the creep is executing its logic.
     */
    run(room) {
        if (!global.State || !global.State.creepsByRoom) return;

        const roomCreeps = global.State.creepsByRoom.get(room.name);
        if (!roomCreeps) return;

        const powerAttackers = roomCreeps.get('powerAttacker');
        if (!powerAttackers || powerAttackers.length === 0) return;

        for (const creep of powerAttackers) {
            try {
                if (creep.fatigue > 0) continue;

                // TODO: Add implementation logic here
            } catch (e) {
                console.log(`[powerAttacker Error] Room ${room.name}, Creep ${creep.name}: ${e.stack}`);
            }
        }
    }
};
