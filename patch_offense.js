const fs = require('fs');

let offense = fs.readFileSync('src/operations/offense.js', 'utf8');

const newFunctions = `
/**
 * Dispatches [ATTACK, MOVE] creeps to hunt enemy remote miners in neutral rooms.
 */
function runHarassment() {
    if (!global.State || !global.State.creepsByRoom) return;

    // We assume 'harasser' role exists or we use 'rampartMelee' as generic attackers
    const hunters = [];
    for (const roomCreeps of global.State.creepsByRoom.values()) {
        const h = roomCreeps.get('harasser') || [];
        hunters.push(...h);
    }

    for (const hunter of hunters) {
        if (hunter.fatigue > 0) continue;

        const targetRoomName = hunter.memory.targetRoom;
        if (!targetRoomName) continue;

        // Filter out rooms with active Towers
        let hasTower = false;
        if (Game.rooms[targetRoomName]) {
            const towers = Game.rooms[targetRoomName].find(FIND_HOSTILE_STRUCTURES, {
                filter: s => s.structureType === STRUCTURE_TOWER
            });
            if (towers.length > 0) hasTower = true;
        } else if (global.State.intel && global.State.intel.has(targetRoomName)) {
            const intel = global.State.intel.get(targetRoomName);
            if (intel.towers > 0) hasTower = true;
        }

        if (hasTower) {
            hunter.memory.targetRoom = null; // Re-evaluate
            continue;
        }

        if (hunter.room.name !== targetRoomName) {
            hunter.moveTo(new RoomPosition(25, 25, targetRoomName));
        } else {
            const hostiles = global.State.hostilesByRoom.get(targetRoomName) || [];
            const bestTarget = CombatManager.getBestTarget(hunter, hostiles);
            if (bestTarget) {
                if (hunter.attack(bestTarget) === ERR_NOT_IN_RANGE) {
                    hunter.moveTo(bestTarget);
                }
            }
        }
    }
}

/**
 * Coordinates fast attack squads and reroutes haulers to steal dropped energy.
 */
function runPoaching() {
    if (!global.State || !global.State.creepsByRoom) return;

    for (const [roomName, roomCreeps] of global.State.creepsByRoom) {
        const poachers = roomCreeps.get('poacher') || [];
        for (const poacher of poachers) {
            if (poacher.fatigue > 0) continue;
            // Attack remote harvesters
            const hostiles = global.State.hostilesByRoom.get(roomName) || [];
            const target = CombatManager.getBestTarget(poacher, hostiles);
            if (target) {
                if (poacher.attack(target) === ERR_NOT_IN_RANGE) {
                    poacher.moveTo(target);
                }
            }
        }

        // Reroute haulers
        const remoteHaulers = roomCreeps.get('remoteHauler') || [];
        for (const hauler of remoteHaulers) {
            const dropped = global.State.droppedByRoom.get(roomName) || new Map();
            let massiveDrop = null;
            for (const drop of dropped.values()) {
                if (drop.resourceType === RESOURCE_ENERGY && drop.amount > 500) {
                    massiveDrop = drop;
                    break;
                }
            }

            if (massiveDrop && hauler.store.getFreeCapacity() > 0) {
                if (hauler.pickup(massiveDrop) === ERR_NOT_IN_RANGE) {
                    hauler.moveTo(massiveDrop);
                }
                hauler.heap.state = 'poaching'; // Override normal state
            }
        }
    }
}
`;

offense = offense.replace(/runCoreSnipers\(\);\n    \} catch/,
`runCoreSnipers();
        runHarassment();
        runPoaching();
    } catch`);

offense = offense.replace(/const coreSniper = require\('\.\.\/roles\/coreSniper'\);/,
`const coreSniper = require('../roles/coreSniper');\n${newFunctions}`);

fs.writeFileSync('src/operations/offense.js', offense);
