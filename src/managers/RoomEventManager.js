/* global EVENT_ATTACK, EVENT_BUILD, EVENT_OBJECT_DESTROYED, EVENT_HARVEST, EVENT_REPAIR */
const eventBus = require('../os/eventBus');
const Profiler = require('../utils/profiler');

/**
 * Parses room event logs and publishes them to the event bus.
 * This manager provides the foundation for zero-polling reactivity.
 */
function roomEventManager() {
    if (!global.State || !global.State.scannedRooms) return;

    for (const roomName of global.State.scannedRooms) {
        const events = global.State.getEvents ? global.State.getEvents(roomName) : (global.State.eventCache.get(roomName) || []);
        if (!events || events.length === 0) continue;

        for (const event of events) {
            const eventPayload = { roomName, event };

            switch (event.event) {
                case EVENT_ATTACK:
                    eventBus.publish('HOSTILE_SPOTTED', eventPayload);
                    break;
                case EVENT_BUILD:
                    eventBus.publish('CONSTRUCTION_STARTED', eventPayload);
                    eventBus.publish('INVALIDATE_COSTMATRIX', roomName);
                    break;
                case EVENT_OBJECT_DESTROYED:
                    eventBus.publish('STRUCTURE_DECAY', eventPayload);
                    eventBus.publish('INVALIDATE_COSTMATRIX', roomName);
                    break;
                case EVENT_HARVEST:
                    eventBus.publish('ROOM_EVENT_HARVEST', eventPayload);
                    break;
                case EVENT_REPAIR:
                    eventBus.publish('ROOM_EVENT_REPAIR', eventPayload);
                    break;
                default:
                    // Ignore other events
                    break;
            }
        }
    }
}

module.exports = Profiler.wrap('roomEventManager', roomEventManager);
