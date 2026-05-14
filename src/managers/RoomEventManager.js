/* global EVENT_ATTACK, EVENT_OBJECT_DESTROYED, EVENT_BUILD */
const eventBus = require('../os/eventBus');
const Profiler = require('../utils/profiler');

/**
 * Parses room event logs and publishes them to the event bus.
 * This manager provides the foundation for zero-polling reactivity.
 */
function roomEventManager() {
    if (!global.State || !global.State.scannedRooms) return;

    for (const roomName of global.State.scannedRooms) {
        const room = Game.rooms[roomName];
        if (!room) continue;

        // room.getEventLog() returns events that occurred *only during the previous tick*.
        // It is fresh every tick, so we process it directly.
        const currentEventLog = room.getEventLog() || [];

        if (currentEventLog.length === 0) continue;

        for (const event of currentEventLog) {
            const eventPayload = { roomName, event };

            switch (event.event) {
                case EVENT_ATTACK:
                    eventBus.publish('ATTACK', eventPayload);
                    break;
                case EVENT_OBJECT_DESTROYED:
                    // Only emit STRUCTURE_DECAY if it's actually a structure being destroyed (not creeps dying).
                    // In Screeps, event.data.type holds the object type (e.g. 'creep', 'road', etc).
                    if (event.data && event.data.type && event.data.type !== 'creep') {
                        eventBus.publish('STRUCTURE_DECAY', eventPayload);
                    }
                    break;
                case EVENT_BUILD:
                    // Check if construction finished.
                    // By the time this script runs in the current tick, the ConstructionSite
                    // (if it still exists) has already had its progress updated to include the previous tick's build amount.
                    // Relying solely on `!site` is the correct approach to detecting completion.
                    if (event.data && event.data.targetId) {
                        const targetId = event.data.targetId;
                        const site = Game.getObjectById(targetId);

                        // If the site no longer exists, it has been completed
                        if (!site) {
                            eventBus.publish('CONSTRUCTION_FINISHED', eventPayload);
                        }
                    }
                    break;
                default:
                    // Ignore other events
                    break;
            }
        }
    }
}

module.exports = Profiler.wrap('roomEventManager', roomEventManager);