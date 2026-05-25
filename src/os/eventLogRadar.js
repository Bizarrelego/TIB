const eventBus = require('./eventBus');
const Profiler = require('../utils/profiler');
const {
    EVENT_HOSTILE_SPOTTED,
    EVENT_HOSTILE_ATTACK,
    EVENT_CONSTRUCTION_STARTED,
    EVENT_INVALIDATE_COSTMATRIX,
    EVENT_STRUCTURE_DECAY,
    EVENT_CREEP_DEATH,
    EVENT_ROOM_HARVEST,
    EVENT_ROOM_REPAIR,
    EVENT_ROOM_TRANSFER
} = require('../constants/eventTypes');

/**
 * Parses room event logs and publishes them to the event bus.
 * This manager provides the foundation for zero-polling reactivity.
 */
function eventLogRadar() {
    if (typeof Game === 'undefined' || !Game.rooms) return;

    for (const room of Object.values(Game.rooms)) {
        const roomName = room.name;
        // Retrieve the tick-scoped cached event log
        const events = global.State && global.State.getEvents ? global.State.getEvents(roomName) : (room.getEventLog() || []);

        if (!events || events.length === 0) continue;

        for (const event of events) {
            const eventPayload = { roomName, event };

            switch (event.event) {
                case EVENT_ATTACK:
                    eventBus.publish(EVENT_HOSTILE_SPOTTED, eventPayload);
                    eventBus.publish(EVENT_HOSTILE_ATTACK, {
                        roomName,
                        targetId: event.data.targetId,
                        attackerId: event.objectId,
                        damage: event.data.damage
                    });
                    break;
                case EVENT_BUILD:
                    eventBus.publish(EVENT_CONSTRUCTION_STARTED, eventPayload);
                    eventBus.publish(EVENT_INVALIDATE_COSTMATRIX, roomName);
                    break;
                case EVENT_OBJECT_DESTROYED:
                    if (event.data && event.data.type === 'creep') {
                        eventBus.publish(EVENT_CREEP_DEATH, eventPayload);
                    } else {
                        eventBus.publish(EVENT_STRUCTURE_DECAY, eventPayload);
                        eventBus.publish(EVENT_INVALIDATE_COSTMATRIX, roomName);
                    }
                    break;
                case EVENT_HARVEST:
                    eventBus.publish(EVENT_ROOM_HARVEST, eventPayload);
                    break;
                case EVENT_REPAIR:
                    eventBus.publish(EVENT_ROOM_REPAIR, eventPayload);
                    break;
                case EVENT_TRANSFER:
                    eventBus.publish(EVENT_ROOM_TRANSFER, eventPayload);
                    break;
                default:
                    // Ignore other events
                    break;
            }
        }
    }
}

module.exports = Profiler.wrap('eventLogRadar', eventLogRadar);
