const eventBus = require('../os/eventBus');
const Profiler = require('../utils/profiler');
const {
    EVENT_STRUCTURE_DAMAGED,
    EVENT_ROOM_BUILD
} = require('../constants/eventTypes');
require('../os/StructureStateTracker'); // Initialize tracker subscriptions

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
                    if (event.data && event.data.targetId && event.data.damage) {
                        eventBus.publish(EVENT_STRUCTURE_DAMAGED, {
                            targetId: event.data.targetId,
                            damage: event.data.damage
                        });
                    }
                    break;
                case EVENT_BUILD:
                    eventBus.publish('CONSTRUCTION_STARTED', eventPayload);
                    eventBus.publish('INVALIDATE_COSTMATRIX', roomName);
                    if (event.data && event.data.targetId) {
                        eventBus.publish(EVENT_ROOM_BUILD, eventPayload);
                    }
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
