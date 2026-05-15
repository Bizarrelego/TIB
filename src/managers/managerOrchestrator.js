const Profiler = require('../utils/profiler');
const globalState = require('../state/globalState');

/**
 * Centrally orchestrates standalone room managers.
 * Enforces CPU throttling and error isolation.
 * Iterates over global.State to maintain Zero Native Polling.
 */
function managerOrchestrator() {
    // Enforce CPU throttling
    if (Game.cpu.bucket < 500) return;

    if (!global.State) return;

    // Process event logs centrally
    const roomEventManager = globalState.getManager ? globalState.getManager('RoomEventManager') : null;
    if (roomEventManager) {
        try {
            roomEventManager();
        } catch (e) {
            console.log(`[ManagerOrchestrator Error] RoomEventManager: ${e.stack}`);
        }
    }

    // Determine rooms to iterate over (Zero Native Polling)
    const roomsToProcess = global.State.rooms || (global.State.scannedRooms ? Array.from(global.State.scannedRooms).map(name => Game.rooms[name]).filter(r => r) : []);

    if (!roomsToProcess || roomsToProcess.length === 0) return;

    // Get registered managers
    const managers = globalState.managers || new Map();

    for (let i = 0; i < roomsToProcess.length; i++) {
        const room = roomsToProcess[i];
        if (!room) continue;

        for (const [managerName, manager] of managers.entries()) {
            // Skip utility classes and RoomEventManager (already called)
            if (managerName === 'CombatManager' || managerName === 'EnergyRequestManager' || managerName === 'RoomEventManager') {
                continue;
            }

            if (manager && typeof manager.run === 'function') {
                try {
                    manager.run(room);
                } catch (e) {
                    console.log(`[ManagerOrchestrator Error] ${managerName} in Room ${room.name}: ${e.stack}`);
                }
            }
        }
    }
}

module.exports = Profiler.wrap('managerOrchestrator', managerOrchestrator);
