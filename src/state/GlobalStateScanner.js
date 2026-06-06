const IntelManager = require('../managers/IntelManager');
const RoomStateScanner = require('./RoomStateScanner');

/**
 * Module responsible for building the global state object by scanning rooms.
 * Optimized for RCL 1-8 via Single-Pass Binning, V8 Monomorphism, and Object Reuse.
 * @module GlobalStateScanner
 */

function run() {
    if (!global.State) global.State = { rooms: new Map() };

    global.State.rooms = RoomStateScanner.run(global.State.rooms);

    const creepNames = Object.keys(Game.creeps);
    for (let i = 0; i < creepNames.length; i++) {
        const creep = Game.creeps[creepNames[i]];
        const roomName = creep.memory.room || creep.room.name;
        const role = creep.memory.role;

        const roomState = global.State.rooms.get(roomName);
        if (roomState) {
            roomState.creeps.push(creep);
            if (role && roomState.creepCounts[role] !== undefined) {
                roomState.creepCounts[role]++;
            }
        }
    }

    // Delegation to IntelManager to maintain Single Responsibility for data processing
    IntelManager.run();
}

module.exports = {
    run
};
