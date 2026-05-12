/* global EVENT_OBJECT_DESTROYED, EVENT_ATTACK, EVENT_HEAL */
const { CacheRegistry } = require('../os/cache');

module.exports = function stateScanner() {
    if (!global.State?.scannedRooms) return;

    // Use pre-existing Maps from segment pointers directly; avoid Object.entries() conversion
    // Segment 1: Creeps, Segment 0: Structures
    try {
        if (global.State.getSegmentMap) {
            const creepMap = global.State.getSegmentMap(1); // Assume helper returns Map
            const structMap = global.State.getSegmentMap(0);

            if (creepMap instanceof Map) CacheRegistry.hydrate('creeps', creepMap);
            if (structMap instanceof Map) CacheRegistry.hydrate('structures', structMap);
        }
    } catch (e) {
        // Error boundaries: Isolated failure
        console.log(`[stateScanner] Cache hydration failed: ${e.stack}`);
    }

    // Pure Event-Driven Consumer Loop
    for (const roomName of global.State.scannedRooms) {
        // Read directly from cached raw memory/event stream populated by discoveryManager
        const events = global.State.getEvents ? global.State.getEvents(roomName) : (global.State.eventCache.get(roomName) || []);

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
