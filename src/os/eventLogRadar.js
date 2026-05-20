const eventBus = require('./eventBus');
const Profiler = require('../utils/profiler');

/**
 * Parses room event logs and publishes them to the event bus.
 * This manager provides the foundation for zero-polling reactivity.
 */
function eventLogRadar() {
    if (typeof Game === 'undefined' || !Game.rooms) return;

    for (const room of Object.values(Game.rooms)) {
        const roomName = room.name;
        // Parse the native engine event log directly
        const currentEventLog = room.getEventLog() || [];

        // Event log in screeps is generated per tick. We process the entire log.
        const events = currentEventLog;

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

module.exports = Profiler.wrap('eventLogRadar', eventLogRadar);
