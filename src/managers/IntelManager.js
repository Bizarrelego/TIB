/**
 * Top-Down Intelligence Manager
 * Serializes visible room data to Memory and queues scouting targets.
 */

const createRoomMemoryTemplate = () => ({
    scoutedAt: 0,
    sources: 0,
    controller: { owner: null, level: 0, safeMode: 0 },
    // New property for scavenging
    droppedEnergy: 0
});

class IntelManager {
    static run() {
        if (!Memory.rooms) Memory.rooms = {};
        
        const visibleRooms = Object.keys(Game.rooms);
        for (let i = 0; i < visibleRooms.length; i++) {
            IntelManager.scanAndSave(Game.rooms[visibleRooms[i]]);
        }

        global.State.scoutQueue = IntelManager.buildScoutQueue(visibleRooms);
    }

    static scanAndSave(room) {
        if (!Memory.rooms[room.name]) {
            Memory.rooms[room.name] = createRoomMemoryTemplate();
        }

        const mem = Memory.rooms[room.name];
        mem.scoutedAt = Game.time;
        
        mem.sources = room.find(FIND_SOURCES).length;
        
        if (room.controller) {
            mem.controller.owner = room.controller.owner ? room.controller.owner.username : null;
            mem.controller.level = room.controller.level;
            mem.controller.safeMode = room.controller.safeMode || 0;
        }

        // Calculate total dropped energy for remote scavengers
        const drops = room.find(FIND_DROPPED_RESOURCES, { filter: r => r.resourceType === RESOURCE_ENERGY });
        let totalDrops = 0;
        for (let i = 0; i < drops.length; i++) {
            totalDrops += drops[i].amount;
        }
        mem.droppedEnergy = totalDrops;
    }

    static buildScoutQueue(visibleRooms) {
        const queue = [];
        for (let i = 0; i < visibleRooms.length; i++) {
            const exits = Game.map.describeExits(visibleRooms[i]);
            if (!exits) continue;

            const exitRooms = Object.values(exits);
            for (let j = 0; j < exitRooms.length; j++) {
                const adjRoom = exitRooms[j];
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