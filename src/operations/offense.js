const Profiler = require('../utils/profiler');
/**
 * @file offense.js
 * @description Manages combat & siege execution.
 */

const CombatManager = require('../managers/CombatManager');
const coreSniper = require('../roles/coreSniper');

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
            const structures = global.State.structuresByRoom.get(targetRoomName);
            const towers = structures ? structures.get(STRUCTURE_TOWER) || [] : [];
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


/**
 * Drives all active quads. Implements 4-creep lockstep chain-pulling.
 * @returns {void}
 */
function runAtomicQuads() {
    if (!global.State || !global.State.activeQuads) return;

    for (const [, quadObj] of global.State.activeQuads) {
        if (!quadObj.creeps || quadObj.creeps.length === 0) continue;

        // Find direction (placeholder logic, usually fetched from quadObj.target or pathing)
        const direction = quadObj.direction || TOP;

        CombatManager.atomicQuadMove(quadObj.creeps, direction);
    }
}

/**
 * Syncs attacker intents within a room, holding fire until ready to hit a target on the exact same tick.
 * @returns {void}
 */
function runSynchronizedBurst() {
    if (!global.State || !global.State.creepsByRoom) return;

    // Example logic using synchronized burst for all attackers in a room
    for (const [roomName, roomCreeps] of global.State.creepsByRoom) {
        const attackers = roomCreeps.get('quadAttacker') || [];
        if (attackers.length === 0) continue;

        const hostiles = global.State.hostilesByRoom ? global.State.hostilesByRoom.get(roomName) || [] : [];
        if (hostiles.length === 0) continue;

        const bestTarget = CombatManager.getBestTarget(attackers[0], hostiles);
        if (bestTarget) {
            CombatManager.synchronizedBurst(attackers, bestTarget);
        }
    }
}

/**
 * Orchestrates tower draining operations. Steps into tower range, eats damage, and heals using I-frames.
 * @returns {void}
 */
function runTowerDrain() {
    if (!global.State || !global.State.creepsByRoom) return;

    for (const [roomName, roomCreeps] of global.State.creepsByRoom) {
        const drainers = roomCreeps.get('drainerHunter') || [];
        if (drainers.length === 0) continue;

        const roomStructures = global.State.structuresByRoom ? global.State.structuresByRoom.get(roomName) || new Map() : new Map();
        const towers = roomStructures.get(STRUCTURE_TOWER) || [];
        const enemyTowers = [];
        for (let i = 0; i < towers.length; i++) {
            if (!towers[i].my) {
                enemyTowers.push(towers[i]);
            }
        }

        const hostiles = global.State.hostilesByRoom ? global.State.hostilesByRoom.get(roomName) || [] : [];

        for (const drainer of drainers) {
            CombatManager.predictivePreHeal(drainer, enemyTowers, hostiles);

            // Assuming drainer has a memory property for its retreat room
            const retreatRoomName = drainer.memory.homeRoom;
            if (retreatRoomName) {
                 CombatManager.borderBounce(drainer, retreatRoomName);
            }
        }
    }
}

/**
 * Orchestrates core sniping operations to block or kill enemy upgraders.
 * @returns {void}
 */
function runCoreSnipers() {
    // Rely on Game.rooms to iterate valid visible rooms for snipers
    const rooms = Object.values(Game.rooms);
    for (const room of rooms) {
        coreSniper.run(room);
    }
}

/**
 * Main offense loop executing atomic combat intents.
 * @returns {void}
 */
module.exports = Profiler.wrap('offenseManager', function offenseManager() {
    try {
        // Execute heavy combat logic
        runAtomicQuads();
        runSynchronizedBurst();
        runTowerDrain();
        runCoreSnipers();
        runHarassment();
        runPoaching();
    } catch (e) {
        console.error(`[OffenseManager Error] ${e.stack}`);
    }
});
