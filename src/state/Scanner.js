/* global EVENT_OBJECT_SPAWN */
const Scanner = {
    updateHostiles(room) {
        const log = room.getEventLog();
        const cache = global.Cache.rooms.get(room.name);

        // Initialize if empty using Set for O(1)
        if (!cache.hostileIds) {
            cache.hostileIds = new Set();
        }

        let hasAttack = false;
        for (let i = 0; i < log.length; i++) {
            const event = log[i];
            if (event.event === EVENT_ATTACK) {
                hasAttack = true;
                break;
            }
        }
        
        if (hasAttack) {
            const hostiles = room.find(FIND_HOSTILE_CREEPS);
            cache.hostileIds.clear();
            for (let i = 0; i < hostiles.length; i++) {
                cache.hostileIds.add(hostiles[i].id);
            }
        }

        return Array.from(cache.hostileIds).map(id => Game.getObjectById(id)).filter(Boolean);
    },

    updateDropped(room) {
        const log = room.getEventLog();
        const cache = global.Cache.rooms.get(room.name);

        if (!cache.droppedIds) {
            cache.droppedIds = new Set();
        }

        for (let i = 0; i < log.length; i++) {
            const event = log[i];
            // Dropped resources don't trigger EVENT_OBJECT_SPAWN natively, but following standard structure
            if (typeof EVENT_OBJECT_SPAWN !== 'undefined' && event.event === EVENT_OBJECT_SPAWN) {
                const obj = Game.getObjectById(event.objectId);
                if (obj && obj.amount) cache.droppedIds.add(event.objectId);
            }
            if (event.event === EVENT_OBJECT_DESTROYED) {
                cache.droppedIds.delete(event.objectId);
            }
        }

        return Array.from(cache.droppedIds).map(id => Game.getObjectById(id)).filter(Boolean);
    }
};

module.exports = Scanner;
