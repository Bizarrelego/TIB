const RoomStateScanner = require('./RoomStateScanner');
const Colony = require('../empire/Colony');

/**
 * Module responsible for building the global state object by scanning rooms.
 * Optimized for RCL 1-8 via Single-Pass Binning, V8 Monomorphism, and Object Reuse.
 * @module GlobalStateScanner
 */

function run() {
    if (!global.State) global.State = { rooms: new Map(), colonies: new Map() };
    if (!global.State.colonies) global.State.colonies = new Map();

    // Rebuild colonies every tick
    global.State.colonies.clear();
    for (const roomName in Game.rooms) {
        const room = Game.rooms[roomName];
        if (room.controller && room.controller.my) {
            global.State.colonies.set(roomName, new Colony(roomName));
        }
    }

    // Clear creeps and creepCounts for all initialized rooms from the previous tick
    for (const roomState of global.State.rooms.values()) {
        roomState.creeps = [];
        roomState.harvesters = [];
        roomState.upgraders = [];
        for (const role in roomState.creepCounts) {
            roomState.creepCounts[role] = 0;
        }
    }

    for (const creepName in Game.creeps) {
        const creep = Game.creeps[creepName];
        const roomName = creep.memory.room || creep.room.name;
        const role = creep.memory.role;

        let roomState = global.State.rooms.get(roomName);
        if (!roomState) {
            roomState = RoomStateScanner.createRoomStateTemplate();
            global.State.rooms.set(roomName, roomState);
        }

        roomState.creeps.push(creep);
        if (role === 'harvester') roomState.harvesters.push(creep);
        if (role === 'upgrader') roomState.upgraders.push(creep);
        
        if (role && roomState.creepCounts[role] !== undefined) {
            roomState.creepCounts[role]++;
        }
    }
}

module.exports = {
    run
};