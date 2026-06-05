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
        // Run every 10 ticks to save CPU
        if (Game.time % 10 !== 0) return;
        
        if (!Memory.rooms) {
            Memory.rooms = {};
        }

        const visibleRooms = Object.keys(Game.rooms);
        for (let i = 0; i < visibleRooms.length; i++) {
            IntelManager.scanAndSave(Game.rooms[visibleRooms[i]]);
        }

        global.State.scoutQueue = IntelManager.buildScoutQueue(visibleRooms);
    }

    static scanAndSave(room) {
        if (!Memory.rooms) {
            Memory.rooms = {};
        }

        let mem = Memory.rooms[room.name];
        if (!mem) {
            mem = createRoomMemoryTemplate();
            Memory.rooms[room.name] = mem;
        }

        mem.scoutedAt = Game.time;
        
        // Ensure nested objects exist in case of schema updates on existing memory
        if (!mem.controller) mem.controller = { owner: null, level: 0, safeMode: 0, x: 0, y: 0 };
        if (!mem.hostiles) mem.hostiles = { creeps: 0, towers: 0, invaderCore: false };

        const state = global.State.rooms.get(room.name);
        if (!state) return;
        
        // 1. Detailed Source Intelligence
        const sources = state.sources || [];
        const memSources = [];
        for (let i = 0; i < sources.length; i++) {
            memSources.push({
                id: sources[i].id,
                x: sources[i].pos.x,
                y: sources[i].pos.y
            });
        }
        mem.sources = memSources;
        
        // 2. Controller Intelligence
        const controllerObj = mem.controller;
        if (room.controller) {
            controllerObj.owner = room.controller.owner ? room.controller.owner.username : null;
            controllerObj.level = room.controller.level;
            controllerObj.safeMode = room.controller.safeMode || 0;
            controllerObj.x = room.controller.pos.x;
            controllerObj.y = room.controller.pos.y;
        } else {
            controllerObj.owner = null;
        }

        // 3. Mineral Intelligence
        const mineral = state.mineral;
        if (mineral) {
            mem.mineral = {
                id: mineral.id,
                type: mineral.mineralType,
                x: mineral.pos.x,
                y: mineral.pos.y
            };
        } else {
            mem.mineral = null;
        }

        // 4. Hostile Threat Assessment
        const hostileCreeps = state.hostiles || [];
        const towers = state.towers || [];
        const hostileTowers = towers.filter(s => !s.my && s.structureType === STRUCTURE_TOWER);
        // We use state.structureIds and filtering for invaderCores if needed, but let's just use room.find for invader core since it's not in state
        const invaderCores = room.find(FIND_HOSTILE_STRUCTURES, { filter: s => s.structureType === STRUCTURE_INVADER_CORE });

        const hostilesObj = mem.hostiles;
        hostilesObj.creeps = hostileCreeps.length;
        hostilesObj.towers = hostileTowers.length;
        hostilesObj.invaderCore = invaderCores.length > 0;

        // 5. Scavenging Data
        const drops = state.droppedEnergy || [];
        let totalDrops = 0;
        for (let i = 0; i < drops.length; i++) {
            totalDrops += drops[i].amount;
        }
        mem.droppedEnergy = totalDrops;
    }

    static buildScoutQueue(visibleRooms) {
        if (!Memory.rooms) {
            Memory.rooms = {};
        }

        const queue = [];
        for (let i = 0; i < visibleRooms.length; i++) {
            const exits = Game.map.describeExits(visibleRooms[i]);
            if (!exits) continue;

            const exitRooms = Object.values(exits);
            for (let j = 0; j < exitRooms.length; j++) {
                const adjRoom = exitRooms[j];
                const mem = Memory.rooms[adjRoom];
                // Reduced from 5000 to 3000. Hostile data goes stale fast.
                if (!mem || (Game.time - mem.scoutedAt > 3000)) {
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