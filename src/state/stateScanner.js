/* global EVENT_OBJECT_DESTROYED, EVENT_ATTACK, EVENT_HEAL */
const { CacheRegistry } = require('../os/cache');

module.exports = function stateScanner() {
    if (!global.State || !global.State.scannedRooms) return;

    // Event-Driven Hydration: Synchronize global.Cache
    if (global.State.getSegment) {
        CacheRegistry.hydrate('creeps', global.State.getSegment(1) || {});
        CacheRegistry.hydrate('structures', global.State.getSegment(0) || {});
    }

    // Pure Event-Driven Consumer Loop
    for (const roomName of global.State.scannedRooms) {
        // Read directly from cached raw memory/event stream populated by discoveryManager
        const events = global.State.eventCache.get(roomName) || [];

        const roomStructures = global.State.structuresByRoom.get(roomName) || new Map();
        const roomHostiles = global.State.hostilesByRoom.get(roomName) || new Map();
        const roomLogistics = global.State.logisticsByRoom.get(roomName) || new Map();

        for (const event of events) {
            if (event.event === EVENT_OBJECT_DESTROYED) {
                roomStructures.delete(event.objectId);
                global.State.structureCache.delete(event.objectId);
                roomHostiles.delete(event.objectId);
                roomLogistics.delete(event.objectId);
            } else if (event.event === EVENT_ATTACK || event.event === EVENT_HEAL) {
                roomHostiles.set(event.objectId, { id: event.objectId, room: roomName, isHostile: true });
            }
        }

        // Clean up creeps maps for dead creeps using O(1) logic instead of array iteration
        const roomCreeps = global.State.creepsByRoom.get(roomName) || new Map();
        for (const id of roomCreeps.keys()) {
            const creep = roomCreeps.get(id);
            if (!global.State.creepLookup.has(creep.name)) {
                roomCreeps.delete(id); // Creep died
            }
        }
    }
};
