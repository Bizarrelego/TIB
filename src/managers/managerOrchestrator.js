const globalState = require('../state/globalState');

/**
 * Centrally orchestrates standalone room managers to prevent circular dependencies
 * and enforces CPU throttling.
 */
function run() {
    if (typeof Game === 'undefined' || !Game.cpu || Game.cpu.bucket < 500) return; // CPU throttling check

    const managerNames = Array.from(globalState.managers.keys());


    if (!global.State || !global.State.scannedRooms) return;
    for (const roomName of global.State.scannedRooms) {
        const room = Game.rooms[roomName];
        if (!room) continue;

        if (room.controller && room.controller.my) {
            for (const name of managerNames) {
                try {
                    const manager = globalState.getManager(name);
                    if (manager && typeof manager.run === 'function') {
                        manager.run(room);
                    }
                } catch (e) {
                    console.log(`[ManagerOrchestrator Error] Manager ${name} in Room ${room.name}: ${e.stack}`);
                }
            }
        }
    }
}

module.exports = { run };
