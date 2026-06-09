const ActionConstants = require('../constants/ActionConstants');

/**
 * Implements a self-sustaining, memory-driven map crawler that prioritizes stale intel 
 * without requiring expensive global pathfinding queues.
 */
class ScoutingManager {
    static run() {
        if (!Memory.rooms) Memory.rooms = {};

        for (const creepName in Game.creeps) {
            const creep = Game.creeps[creepName];
            if (creep.memory.role !== 'scout') continue;

            // If the scout is moving between rooms, skip it
            if (creep.pos.x === 0 || creep.pos.x === 49 || creep.pos.y === 0 || creep.pos.y === 49) {
                continue;
            }

            if (!creep.heap) creep.heap = {};
            if (!creep.heap.visitedRooms) creep.heap.visitedRooms = [];

            // Add current room to visited log if it's new
            const currentRoom = creep.room.name;
            const lastVisited = creep.heap.visitedRooms.length > 0 ? creep.heap.visitedRooms[creep.heap.visitedRooms.length - 1] : null;
            
            if (currentRoom !== lastVisited) {
                creep.heap.visitedRooms.push(currentRoom);
                if (creep.heap.visitedRooms.length > 3) {
                    creep.heap.visitedRooms.shift();
                }
            }

            if (!creep.memory.targetRoom || creep.room.name === creep.memory.targetRoom || creep.heap.actionIntent === ActionConstants.ACTION_IDLE) {
                const exits = Game.map.describeExits(creep.room.name);
                if (!exits) continue;

                let bestExit = null;
                let oldestTime = Infinity;
                let fallbackExit = null;
                let fallbackTime = Infinity;

                const exitRooms = Object.values(exits);
                for (let i = 0; i < exitRooms.length; i++) {
                    const exitRoom = exitRooms[i];
                    const scoutedAt = Memory.rooms[exitRoom] ? (Memory.rooms[exitRoom].scoutedAt || 0) : 0;

                    if (scoutedAt < fallbackTime) {
                        fallbackTime = scoutedAt;
                        fallbackExit = exitRoom;
                    }

                    let recentlyVisited = false;
                    for (let j = 0; j < creep.heap.visitedRooms.length; j++) {
                        if (creep.heap.visitedRooms[j] === exitRoom) {
                            recentlyVisited = true;
                            break;
                        }
                    }

                    if (recentlyVisited) continue;

                    if (scoutedAt < oldestTime) {
                        oldestTime = scoutedAt;
                        bestExit = exitRoom;
                    }
                }

                if (!bestExit) {
                    bestExit = fallbackExit; 
                }

                if (bestExit) {
                    creep.memory.targetRoom = bestExit;
                    creep.heap.actionIntent = ActionConstants.ACTION_MOVE_ROOM;
                }
            }
        }
    }
}

module.exports = ScoutingManager;
