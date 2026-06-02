/**
 * Top-Down Intelligence Manager
 * Serializes visible room data to Memory and queues scouting targets.
 */

// V8 Optimization: Monomorphic room memory template.
const createRoomMemoryTemplate = () => ({
    scoutedAt: 0,
    sources: 0,
    controller: { owner: null, level: 0, safeMode: 0 }
});

class IntelManager {
    static run() {
        if (!Memory.rooms) Memory.rooms = {};
        
        // 1. Serialize all currently visible rooms to Memory
        const visibleRooms = Object.keys(Game.rooms);
        for (let i = 0; i < visibleRooms.length; i++) {
            this.scanAndSave(Game.rooms[visibleRooms[i]]);
        }

        // 2. Build a list of unscouted adjacent rooms
        global.State.scoutQueue = this.buildScoutQueue(visibleRooms);
    }

    /**
     * Extracts static/semi-static data and saves to Memory.
     * @param {Room} room 
     */
    static scanAndSave(room) {
        if (!Memory.rooms[room.name]) {
            Memory.rooms[room.name] = createRoomMemoryTemplate();
        }

        const mem = Memory.rooms[room.name];
        mem.scoutedAt = Game.time;
        
        // We only care about counts and ownership for remote planning, not IDs.
        mem.sources = room.find(FIND_SOURCES).length;
        
        if (room.controller) {
            mem.controller.owner = room.controller.owner ? room.controller.owner.username : null;
            mem.controller.level = room.controller.level;
            mem.controller.safeMode = room.controller.safeMode || 0;
        }
    }

    /**
     * Checks exits of visible rooms to find rooms missing from Memory.
     * @param {string[]} visibleRooms 
     * @returns {string[]} Array of room names needing a scout.
     */
    static buildScoutQueue(visibleRooms) {
        const queue = [];
        for (let i = 0; i < visibleRooms.length; i++) {
            const exits = Game.map.describeExits(visibleRooms[i]);
            if (!exits) continue;

            const exitRooms = Object.values(exits);
            for (let j = 0; j < exitRooms.length; j++) {
                const adjRoom = exitRooms[j];
                // Flag room if we have never seen it, or if data is older than 5000 ticks.
                if (!Memory.rooms[adjRoom] || (Game.time - Memory.rooms[adjRoom].scoutedAt > 5000)) {
                    if (!queue.includes(adjRoom)) {
                        queue.push(adjRoom);
                    }
                }
            }
        }
        return queue;
    }
}

module.exports = IntelManager;