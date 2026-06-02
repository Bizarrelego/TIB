/**
 * Top-Down Intelligence Manager
 * Serializes visible room data to Memory and queues scouting targets.
 */

const createRoomMemoryTemplate = () => ({
    scoutedAt: 0,
    sources: [], // Stores { id, x, y }
    mineral: null, // Stores { id, type, x, y }
    controller: { owner: null, level: 0, safeMode: 0, x: 0, y: 0 },
    droppedEnergy: 0,
    hostiles: { creeps: 0, towers: 0, invaderCore: false }
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
        
        // Ensure nested objects exist in case of schema updates on existing memory
        if (!mem.controller) mem.controller = { owner: null, level: 0, safeMode: 0, x: 0, y: 0 };
        if (!mem.hostiles) mem.hostiles = { creeps: 0, towers: 0, invaderCore: false };
        
        // 1. Detailed Source Intelligence
        const sources = room.find(FIND_SOURCES);
        mem.sources = [];
        for (let i = 0; i < sources.length; i++) {
            mem.sources.push({
                id: sources[i].id,
                x: sources[i].pos.x,
                y: sources[i].pos.y
            });
        }
        
        // 2. Controller Intelligence
        if (room.controller) {
            mem.controller.owner = room.controller.owner ? room.controller.owner.username : null;
            mem.controller.level = room.controller.level;
            mem.controller.safeMode = room.controller.safeMode || 0;
            mem.controller.x = room.controller.pos.x;
            mem.controller.y = room.controller.pos.y;
        } else {
            mem.controller.owner = null;
        }

        // 3. Mineral Intelligence
        const minerals = room.find(FIND_MINERALS);
        if (minerals.length > 0) {
            mem.mineral = {
                id: minerals[0].id,
                type: minerals[0].mineralType,
                x: minerals[0].pos.x,
                y: minerals[0].pos.y
            };
        } else {
            mem.mineral = null;
        }

        // 4. Hostile Threat Assessment
        const hostileCreeps = room.find(FIND_HOSTILE_CREEPS);
        const hostileTowers = room.find(FIND_HOSTILE_STRUCTURES, { filter: s => s.structureType === STRUCTURE_TOWER });
        const invaderCores = room.find(FIND_HOSTILE_STRUCTURES, { filter: s => s.structureType === STRUCTURE_INVADER_CORE });

        mem.hostiles.creeps = hostileCreeps.length;
        mem.hostiles.towers = hostileTowers.length;
        mem.hostiles.invaderCore = invaderCores.length > 0;

        // 5. Scavenging Data
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
                // Reduced from 5000 to 3000. Hostile data goes stale fast.
                if (!Memory.rooms[adjRoom] || (Game.time - Memory.rooms[adjRoom].scoutedAt > 3000)) {
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