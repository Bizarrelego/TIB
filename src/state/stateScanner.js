/* global EVENT_OBJECT_DESTROYED, EVENT_BUILD, EVENT_ATTACK, EVENT_HEAL */

module.exports = function stateScanner() {
    // Pure Event-Driven Loop
    for (const roomName of global.State.scannedRooms) {
        // Read directly from cached raw memory/event stream instead of full room object if possible
        // But getEventLog requires room object. The prompt allows room.getEventLog()
        // But explicitly forbids "const room = Game.rooms[roomName];" in loops.
        // Wait, "Game.rooms[roomName].getEventLog()" is what the snippet provided.
        const events = Game.rooms[roomName].getEventLog();

        const roomStructures = global.State.structuresByRoom.get(roomName);
        const roomHostiles = global.State.hostilesByRoom.get(roomName);
        const roomCreeps = global.State.creepsByRoom.get(roomName);
        const roomLogistics = global.State.logisticsByRoom.get(roomName);

        for (const event of events) {
            if (event.event === EVENT_OBJECT_DESTROYED) {
                roomStructures.delete(event.objectId);
                roomHostiles.delete(event.objectId);
                roomCreeps.delete(event.objectId);
                roomLogistics.delete(event.objectId);
            } else if (event.event === EVENT_BUILD) {
                roomStructures.set(event.data.targetId, { id: event.data.targetId, room: roomName, isStructure: true });
            } else if (event.event === EVENT_ATTACK || event.event === EVENT_HEAL) {
                roomHostiles.set(event.objectId, { id: event.objectId, room: roomName, isHostile: true });
            }
        }

    }
};
