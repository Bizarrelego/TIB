const fs = require('fs');
let code = fs.readFileSync('src/roles/reserver.js', 'utf8');

const replacement = `const movement = require('../utils/movement');

/**
 * Executes logic for reserver role.
 * @param {Room} room The home room of the colony managing these creeps.
 */
function run(room) {
    const roomCreeps = global.State.creepsByRoom.get(room.name);
    if (!roomCreeps) return;

    const reservers = roomCreeps.get('reserver');
    if (!reservers || reservers.length === 0) return;

    for (const creep of reservers) {
        try {
            if (creep.fatigue > 0) continue; // Fatigue gating

            // Check for low ticks to live and renewal
            if (creep.ticksToLive < 100) {
                const spawns = global.State.spawnsByRoom.get(room.name);
                if (spawns && spawns.length > 0) {
                    const spawn = spawns[0];
                    if (creep.pos.isNearTo(spawn)) {
                        spawn.renewCreep(creep);
                    } else {
                        movement.moveTo(creep, spawn);
                    }
                    continue;
                }
            }

            const targetRoomName = creep.memory.targetRoom;
            if (!targetRoomName) continue;

            // If we are not in the target room, move towards it
            if (creep.room.name !== targetRoomName) {
                const targetPos = new RoomPosition(25, 25, targetRoomName);
                movement.moveTo(creep, targetPos);
                continue;
            }

            // We are in the target room. Bounce off the exit tile if needed.
            if (creep.pos.x === 0 || creep.pos.x === 49 || creep.pos.y === 0 || creep.pos.y === 49) {
                const centerPos = new RoomPosition(25, 25, targetRoomName);
                movement.moveTo(creep, centerPos);
                continue;
            }

            // Move to the room's controller
            const controller = creep.room.controller;
            if (!controller) continue;

            if (!controller.owner) {
                if (creep.reserveController(controller) === ERR_NOT_IN_RANGE) {
                    movement.moveTo(creep, controller);
                } else if (creep.claimController(controller) === ERR_NOT_IN_RANGE) {
                    movement.moveTo(creep, controller);
                }
            } else if (controller.owner.username !== creep.owner.username) {
                if (creep.attackController(controller) === ERR_NOT_IN_RANGE) {
                    movement.moveTo(creep, controller);
                }
            } else {
                if (!creep.pos.isNearTo(controller)) {
                    movement.moveTo(creep, controller);
                }
            }

        } catch (e) {
            console.error(\`[reserver Error] Room \${room.name}, Creep \${creep.name}: \${e.stack}\`);
        }
    }
}`;

code = code.replace(/const movement = require\('\.\.\/utils\/movement'\);\s*\/\*\*[\s\S]*\}\s*\n\s*\}/, replacement);

fs.writeFileSync('src/roles/reserver.js', code);
