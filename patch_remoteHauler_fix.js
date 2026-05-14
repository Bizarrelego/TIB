const fs = require('fs');
let code = fs.readFileSync('src/roles/remoteHauler.js', 'utf8');

const replacement = `const movement = require('../utils/movement');
const pathing = require('../utils/pathing');
const TrafficManager = require('../traffic/trafficManager');

/**
 * Executes logic for remoteHauler role.
 * @param {Room} room The home room of the colony managing these creeps.
 */
function run(room) {
    const roomCreeps = global.State.creepsByRoom.get(room.name);
    if (!roomCreeps) return;

    const remoteHaulers = roomCreeps.get('remoteHauler');
    if (!remoteHaulers || remoteHaulers.length === 0) return;

    for (const creep of remoteHaulers) {
        try {
            if (creep.fatigue > 0) continue; // Fatigue gating

            const remoteRoomName = creep.memory.remoteRoom;
            const homeRoomName = creep.memory.homeRoom || room.name;

            if (!remoteRoomName || !homeRoomName) continue;

            if (creep.memory.hauling && creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
                creep.memory.hauling = false;
            }
            if (!creep.memory.hauling && creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
                creep.memory.hauling = true;
            }

            if (!creep.memory.hauling) {
                // We are not hauling, need to go to remote room to pick up energy
                if (creep.room.name !== remoteRoomName) {
                    if (!creep.heap.path || creep.heap.path.length === 0 || creep.heap.path[creep.heap.path.length - 1].roomName !== remoteRoomName) {
                        const pathResult = pathing.findPathToRoom(creep.pos, remoteRoomName);
                        if (pathResult && pathResult.path) {
                            creep.heap.path = pathResult.path;
                        }
                    }
                    if (creep.heap.path && creep.heap.path.length > 0) {
                        creep.moveByPath(creep.heap.path);
                    } else {
                        const targetPos = new RoomPosition(25, 25, remoteRoomName);
                        movement.moveTo(creep, targetPos);
                    }
                    continue;
                }`;

code = code.replace(/const movement = require\('\.\.\/utils\/movement'\);\nconst TrafficManager[\s\S]*?continue;\n                \}/, replacement);

const replacement2 = `            } else {
                // We are hauling (have energy), need to drop it off at home
                if (creep.room.name !== homeRoomName) {
                    if (!creep.heap.path || creep.heap.path.length === 0 || creep.heap.path[creep.heap.path.length - 1].roomName !== homeRoomName) {
                        const pathResult = pathing.findPathToRoom(creep.pos, homeRoomName);
                        if (pathResult && pathResult.path) {
                            creep.heap.path = pathResult.path;
                        }
                    }
                    if (creep.heap.path && creep.heap.path.length > 0) {
                        creep.moveByPath(creep.heap.path);
                    } else {
                        const targetPos = new RoomPosition(25, 25, homeRoomName);
                        movement.moveTo(creep, targetPos);
                    }
                    continue;
                }`;

code = code.replace(/            \} else \{\n                \/\/ We are hauling \(have energy\), need to drop it off at home\n                if \(creep\.room\.name !== homeRoomName\) \{\n                    const targetPos = new RoomPosition\(25, 25, homeRoomName\);\n                    movement\.moveTo\(creep, targetPos\);\n                    continue;\n                \}/, replacement2);

fs.writeFileSync('src/roles/remoteHauler.js', code);
