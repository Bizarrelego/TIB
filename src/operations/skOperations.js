const Profiler = require('../utils/profiler');
const SpawnQueueManager = require('../managers/SpawnQueueManager');

/**
 * @file skOperations.js
 * @description Manages SK room operations, tracks lair spawns, and dispatches SK roles.
 */

/**
 * Extracts coordinates from a room name to determine if it is an SK room.
 * @param {string} roomName
 * @returns {string}
 */
function getRoomType(roomName) {
    const coords = roomName.match(/[a-zA-Z]+|[0-9]+/g);
    if (!coords) return 'regular';
    const x = parseInt(coords[1], 10);
    const y = parseInt(coords[3], 10);

    if (x % 10 === 0 || y % 10 === 0) return 'highway';
    if (x % 10 >= 4 && x % 10 <= 6 && y % 10 >= 4 && y % 10 <= 6) return 'sk';
    if (x % 10 === 5 && y % 10 === 5) return 'center';
    return 'regular';
}

/**
 * Orchestrates SK operations for all scanned rooms.
 */
function runSKOperations() {
    if (!global.State || !global.State.scannedRooms) return;

    if (!global.State.skLairsHeap) {
        global.State.skLairsHeap = new Map();
    }

    for (const roomName of global.State.scannedRooms) {
        const roomType = getRoomType(roomName);
        if (roomType !== 'sk') continue;

        const roomStructures = global.State.structuresByRoom.get(roomName) || new Map();
        const lairs = roomStructures.get(STRUCTURE_KEEPER_LAIR) || new Map();

        let roomLairsHeap = global.State.skLairsHeap.get(roomName);
        if (!roomLairsHeap) {
            roomLairsHeap = new Map();
            global.State.skLairsHeap.set(roomName, roomLairsHeap);
        }

        if (lairs instanceof Map) {
            for (const [id, lair] of lairs.entries()) {
                roomLairsHeap.set(id, lair.ticksToSpawn || 0);
            }
        } else if (Array.isArray(lairs)) {
            for (const lair of lairs) {
                roomLairsHeap.set(lair.id, lair.ticksToSpawn || 0);
            }
        }

        if (Game.time % 50 !== 0) continue;

        let closestRoomName = null;
        let minDistance = Infinity;

        if (global.State.rooms) {
            for (const [baseName, baseRoom] of global.State.rooms.entries()) {
                if (baseRoom.controller && baseRoom.controller.my && baseRoom.energyCapacityAvailable >= 4000) {
                    const dist = Game.map.getRoomLinearDistance(baseName, roomName);
                    if (dist < minDistance) {
                        minDistance = dist;
                        closestRoomName = baseName;
                    }
                }
            }
        }

        if (!closestRoomName) continue;

        // Ensure we have SK mining ops queued
        const BodyCalc = require('../utils/bodyCalc');
        const roomSources = global.State.sourcesByRoom.get(roomName) || [];
        for (const source of roomSources) {
            let minerExists = false;
            for (const creepsByRole of global.State.creepsByRoom.values()) {
                const miners = creepsByRole.get('skMiner') || [];
                for (const m of miners) {
                    if (m.heap.targetRoom === roomName && m.heap.sourceId === source.id) minerExists = true;
                }
            }

            if (!minerExists && SpawnQueueManager.getQueuedCount(closestRoomName, 'skMiner', roomName) === 0) {
                const body = BodyCalc.calculateRemoteMiner(global.State.rooms.get(closestRoomName).energyCapacityAvailable, 4000); // SK sources hold 4k
                SpawnQueueManager.requestSpawn(closestRoomName, 'skMiner', body, 'skMiner_' + Game.time + '_' + Math.floor(Math.random() * 100), {
                    memory: { role: 'skMiner', colony: closestRoomName }, heap: { targetRoom: roomName, sourceId: source.id }
                }, BodyCalc.getCost(body));
            }
        }

        // Ensure SK Guard and Hauler
        let guardExists = false;
        let haulerExists = false;

        for (const creepsByRole of global.State.creepsByRoom.values()) {
            const guards = creepsByRole.get('skGuard') || [];
            for (const g of guards) {
                if (g.heap.targetRoom === roomName) guardExists = true;
            }
            const haulers = creepsByRole.get('skHauler') || [];
            for (const h of haulers) {
                if (h.heap.targetRoom === roomName) haulerExists = true;
            }
        }

        if (!guardExists && SpawnQueueManager.getQueuedCount(closestRoomName, 'skGuard', roomName) === 0) {
            const guardBody = [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, HEAL, HEAL];
            SpawnQueueManager.requestSpawn(closestRoomName, 'skGuard', guardBody, 'skGuard_' + Game.time, {
                memory: { role: 'skGuard', colony: closestRoomName }, heap: { targetRoom: roomName }
            }, BodyCalc.getCost(guardBody));
        }

        if (!haulerExists && SpawnQueueManager.getQueuedCount(closestRoomName, 'skHauler', roomName) === 0) {
            const haulerBody = BodyCalc.calculateHauler(global.State.rooms.get(closestRoomName).energyCapacityAvailable, Game.map.getRoomLinearDistance(closestRoomName, roomName), 10);
            SpawnQueueManager.requestSpawn(closestRoomName, 'skHauler', haulerBody, 'skHauler_' + Game.time + '_' + Math.floor(Math.random() * 100), {
                memory: { role: 'skHauler', colony: closestRoomName }, heap: { targetRoom: roomName }
            }, BodyCalc.getCost(haulerBody));
        }
    }
}

module.exports = Profiler.wrap('skOperations', runSKOperations);
