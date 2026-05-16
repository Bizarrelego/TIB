const fs = require('fs');
const filepath = 'src/operations/skOperations.js';
let content = fs.readFileSync(filepath, 'utf8');

// Replace the start of the loop
content = content.replace(
    "if (getRoomType(roomName) !== 'sk') continue;",
    "const roomType = getRoomType(roomName);\n        if (roomType !== 'sk' && roomType !== 'highway') continue;\n\n        if (roomType === 'sk') {"
);

// Indent the SK block and add the closing brace and highway logic
// The SK block ends at `}, guardCost); }` followed by `// Dispatch skHauler` block.
// Wait, replacing with regex or string replacement for the whole block is safer.

const searchString = `    for (const roomName of global.State.scannedRooms) {
        if (getRoomType(roomName) !== 'sk') continue;`;

const replacementString = `    for (const roomName of global.State.scannedRooms) {
        const roomType = getRoomType(roomName);
        if (roomType !== 'sk' && roomType !== 'highway') continue;

        if (roomType === 'highway') {
            const roomStructures = global.State.structuresByRoom.get(roomName) || new Map();
            const powerBanks = roomStructures.get(STRUCTURE_POWER_BANK);

            if (powerBanks) {
                const banksArray = powerBanks instanceof Map ? Array.from(powerBanks.values()) : powerBanks;
                for (const powerBank of banksArray) {
                    if (Game.time % 50 !== 0) continue; // Dispatch check throttling

                    // Find closest base
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

                    const dist = Game.map.getRoomLinearDistance(closestRoomName, roomName);

                    // Count assigned capacity
                    let assignedCapacity = 0;
                    for (const creepsByRole of global.State.creepsByRoom.values()) {
                        const haulers = creepsByRole.get('powerHauler') || [];
                        for (const h of haulers) {
                            if (h.memory.targetRoom === roomName && h.memory.targetId === powerBank.id) {
                                assignedCapacity += h.store.getCapacity();
                            }
                        }
                    }

                    const ticksToKill = powerBank.hits / 600;
                    const travelTime = dist * 50;

                    if (ticksToKill <= travelTime + 150 && assignedCapacity < powerBank.power) {
                        const BodyCalc = require('../utils/bodyCalc');
                        const body = BodyCalc.calculatePowerHauler(global.State.rooms.get(closestRoomName).energyCapacityAvailable, dist, powerBank.power - assignedCapacity);
                        const cost = BodyCalc.getCost(body);
                        SpawnQueueManager.requestSpawn(closestRoomName, 'powerHauler', body, 'pHaul_' + Game.time + '_' + Math.floor(Math.random() * 100), {
                            memory: { role: 'powerHauler', colony: closestRoomName, targetRoom: roomName, homeRoom: closestRoomName, targetId: powerBank.id }
                        }, cost);
                    }
                }
            }
        }

        if (roomType === 'sk') {`;

content = content.replace(searchString, replacementString);

// We need to close the SK block at the very end of the loop body
content = content.replace(
    `        if (skHaulersCount < 2) {
            const haulerBody = [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
            const haulerCost = 500 + 500; // 1000
            SpawnQueueManager.requestSpawn(closestRoomName, 'skHauler', haulerBody, 'skHauler_' + Game.time + '_' + Math.floor(Math.random() * 100), {
                memory: { role: 'skHauler', colony: closestRoomName, targetRoom: roomName, homeRoom: closestRoomName }
            }, haulerCost);
        }
    }`,
    `        if (skHaulersCount < 2) {
            const haulerBody = [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
            const haulerCost = 500 + 500; // 1000
            SpawnQueueManager.requestSpawn(closestRoomName, 'skHauler', haulerBody, 'skHauler_' + Game.time + '_' + Math.floor(Math.random() * 100), {
                memory: { role: 'skHauler', colony: closestRoomName, targetRoom: roomName, homeRoom: closestRoomName }
            }, haulerCost);
        }
        }
    }`
);

fs.writeFileSync(filepath, content);
