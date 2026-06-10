const ActionConstants = require('../constants/ActionConstants');

class ScoutingManager {
    static run() {
        for (const name in Game.creeps) {
            const creep = Game.creeps[name];
            if (creep.memory.role !== 'scout' || creep.spawning) continue;

            if (!creep.heap) creep.heap = {};

            // 1. Intent Preservation: If it has ANY destination, it hasn't arrived yet. Let TrafficManager finish.
            // Improves execution stability by preventing the scout from overwriting its own destination.
            if (creep.heap.destination) {
                creep.heap.actionIntent = ActionConstants.ACTION_MOVE_ROOM;
                continue;
            }

            // 3. Target Selection: Safe inside a room, needs a new room to scout
            const exits = Game.map.describeExits(creep.room.name);
            if (!exits) continue;

            let oldestRoom = null;
            let oldestTime = Infinity;

            if (!creep.heap.visitedRooms) creep.heap.visitedRooms = [];

            for (const dir in exits) {
                const exitRoom = exits[dir];

                // Prevents fatal pathing deadlocks by utilizing the Game.map API to filter out walled-off beginner sectors and closed map areas.
                const status = Game.map.getRoomStatus(exitRoom);
                if (status && (status.status === 'closed' || status.status === 'novice' || status.status === 'respawn')) {
                    continue;
                }

                // Avoid Source Keeper / Sector Center rooms to prevent instant death loops
                if (ScoutingManager.isKeeperRoom(exitRoom)) continue;

                // Avoid immediate backtracking
                if (creep.heap.visitedRooms.includes(exitRoom) && Object.keys(exits).length > 1) {
                    continue;
                }

                const scoutedAt = Memory.rooms[exitRoom]?.scoutedAt || 0;
                if (scoutedAt < oldestTime) {
                    oldestTime = scoutedAt;
                    oldestRoom = exitRoom;
                }
            }

            // Fallback: If all exits are visited or SK rooms, pick the oldest valid one anyway
            if (!oldestRoom) {
                for (const dir in exits) {
                    const exitRoom = exits[dir];
                    
                    const status = Game.map.getRoomStatus(exitRoom);
                    if (status && (status.status === 'closed' || status.status === 'novice' || status.status === 'respawn')) {
                        continue;
                    }

                    if (ScoutingManager.isKeeperRoom(exitRoom)) continue;

                    const scoutedAt = Memory.rooms[exitRoom]?.scoutedAt || 0;
                    if (scoutedAt < oldestTime) {
                        oldestTime = scoutedAt;
                        oldestRoom = exitRoom;
                    }
                }
            }

            if (oldestRoom) {
                // Update visited rooms history without duplicating the current room erroneously
                if (creep.heap.visitedRooms[creep.heap.visitedRooms.length - 1] !== creep.room.name) {
                    creep.heap.visitedRooms.push(creep.room.name);
                }
                if (creep.heap.visitedRooms.length > 3) {
                    creep.heap.visitedRooms.shift();
                }

                creep.heap.destination = { x: 25, y: 25, roomName: oldestRoom, range: 20 };
                creep.heap.actionIntent = ActionConstants.ACTION_MOVE_ROOM;
            }
        }
    }

    /**
     * Determines if a room is a Source Keeper room or Sector Center based on coordinate math.
     * Prevents scouts from wandering into instant-death zones.
     */
    static isKeeperRoom(roomName) {
        const parsed = /^[WE]([0-9]+)[NS]([0-9]+)$/.exec(roomName);
        if (!parsed) return false;

        const x = parseInt(parsed[1]) % 10;
        const y = parseInt(parsed[2]) % 10;

        // Rooms ending in 4, 5, or 6 in both X and Y are SK rooms or the Sector Center
        return (x >= 4 && x <= 6) && (y >= 4 && y <= 6);
    }

    /**
     * Adds mathematical coordinate parsing to identify cross-map transit corridors.
     */
    static isHighway(roomName) {
        const parsed = /^[WE]([0-9]+)[NS]([0-9]+)$/.exec(roomName);
        if (!parsed) return false;

        const x = parseInt(parsed[1], 10);
        const y = parseInt(parsed[2], 10);

        return (x % 10 === 0) || (y % 10 === 0);
    }
}

module.exports = ScoutingManager;