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

        if (roomType === 'sk') {
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

            let skMinersCount = 0;
            let skGuardsCount = 0;
            let skHaulersCount = 0;

            for (const creepsByRole of global.State.creepsByRoom.values()) {
                const miners = creepsByRole.get('skMiner') || [];
                for (const m of miners) {
                    if (m.memory.targetRoom === roomName) skMinersCount++;
                }

                const guards = creepsByRole.get('skGuard') || [];
                for (const g of guards) {
                    if (g.memory.targetRoom === roomName) skGuardsCount++;
                }

                const haulers = creepsByRole.get('skHauler') || [];
                for (const h of haulers) {
                    if (h.memory.targetRoom === roomName) skHaulersCount++;
                }
            }

            const sources = global.State.sourcesByRoom.get(roomName) || [];
            const requiredMiners = sources.length;

            if (skMinersCount < requiredMiners) {
                const assignedSources = new Set();
                for (const creepsByRole of global.State.creepsByRoom.values()) {
                    const miners = creepsByRole.get('skMiner') || [];
                    for (const m of miners) {
                        if (m.memory.targetRoom === roomName && m.memory.targetSourceId) {
                            assignedSources.add(m.memory.targetSourceId);
                        }
                    }
                }

                for (const source of sources) {
                    if (!assignedSources.has(source.id)) {
                        const body = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE, MOVE];
                        const cost = 1000;
                        SpawnQueueManager.requestSpawn(closestRoomName, 'skMiner', body, 'skMiner_' + Game.time + '_' + Math.floor(Math.random() * 100), {
                            memory: { role: 'skMiner', colony: closestRoomName, targetRoom: roomName, targetSourceId: source.id }
                        }, cost);
                        break;
                    }
                }
            }

            if (skGuardsCount < 1) {
                const guardBody = [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, HEAL, HEAL, HEAL];
                const guardCost = 1810;
                SpawnQueueManager.requestSpawn(closestRoomName, 'skGuard', guardBody, 'skGuard_' + Game.time, {
                    memory: { role: 'skGuard', colony: closestRoomName, targetRoom: roomName }
                }, guardCost);
            }

            if (skHaulersCount < 2) {
                const haulerBody = [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
                const haulerCost = 1000;
                SpawnQueueManager.requestSpawn(closestRoomName, 'skHauler', haulerBody, 'skHauler_' + Game.time + '_' + Math.floor(Math.random() * 100), {
                    memory: { role: 'skHauler', colony: closestRoomName, targetRoom: roomName, homeRoom: closestRoomName }
                }, haulerCost);
            }
        }
    }
}

module.exports = Profiler.wrap('skOperations', runSKOperations);
