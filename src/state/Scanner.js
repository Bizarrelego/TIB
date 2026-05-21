/* global EVENT_OBJECT_SPAWN */
const Scanner = {
    updateHostiles(room) {
        const log = global.State && global.State.getEvents ? global.State.getEvents(room.name) : room.getEventLog();
        let roomCacheMap = global.Cache.get('rooms');
        if (!roomCacheMap.has(room.name)) {
            roomCacheMap.set(room.name, new Map());
        }
        const cache = roomCacheMap.get(room.name);

        // Initialize if empty using Set for O(1)
        if (!cache.has('hostileIds')) {
            cache.set('hostileIds', new Set());
        }
        const hostileIds = cache.get('hostileIds');

        for (let i = 0; i < log.length; i++) {
            const event = log[i];
            if (event.event === EVENT_ATTACK || event.event === EVENT_HEAL) {
                let actor = Game.getObjectById(event.objectId);
                if (actor && actor.my === false && actor.owner && actor.owner.username !== 'Invader') {
                    hostileIds.add(event.objectId);
                }
            } else if (event.event === EVENT_OBJECT_DESTROYED) {
                hostileIds.delete(event.objectId);
            }
        }

        return Array.from(hostileIds).map(id => Game.getObjectById(id)).filter(Boolean);
    },

    updateDropped(room) {
        const log = global.State && global.State.getEvents ? global.State.getEvents(room.name) : room.getEventLog();
        let roomCacheMap = global.Cache.get('rooms');
        if (!roomCacheMap.has(room.name)) {
            roomCacheMap.set(room.name, new Map());
        }
        const cache = roomCacheMap.get(room.name);

        if (!cache.has('droppedIds')) {
            cache.set('droppedIds', new Set());
        }
        const droppedIds = cache.get('droppedIds');

        for (let i = 0; i < log.length; i++) {
            const event = log[i];
            // Dropped resources don't trigger EVENT_OBJECT_SPAWN natively, but following standard structure
            if (typeof EVENT_OBJECT_SPAWN !== 'undefined' && event.event === EVENT_OBJECT_SPAWN) {
                const obj = Game.getObjectById(event.objectId);
                if (obj && obj.amount) droppedIds.add(event.objectId);
            }
            if (event.event === EVENT_OBJECT_DESTROYED) {
                droppedIds.delete(event.objectId);
            }
        }

        return Array.from(droppedIds).map(id => Game.getObjectById(id)).filter(Boolean);
    }
};

module.exports = Scanner;
