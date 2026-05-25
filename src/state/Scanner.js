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

        const hostiles = [];
        for (const id of hostileIds) {
            const obj = Game.getObjectById(id);
            if (obj) hostiles.push(obj);
            else hostileIds.delete(id); // Cleanup dead ids
        }
        return hostiles;
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

        const dropped = [];
        for (const id of droppedIds) {
            const obj = Game.getObjectById(id);
            if (obj) dropped.push(obj);
            else droppedIds.delete(id); // Cleanup dead ids
        }
        return dropped;
    }
};

module.exports = Scanner;
