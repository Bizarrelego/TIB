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
 * Asymmetric Warfare - Poaching (Blueprint Component 53)
 */
function runPoaching() {
    if (!global.State || !global.State.creepsByRoom) return;

    const SpawnQueueManager = require('../managers/SpawnQueueManager');

    for (const [homeRoomName, roomCreeps] of global.State.creepsByRoom) {
        const room = Game.rooms[homeRoomName];
        if (!room || !room.controller || !room.controller.my || room.controller.level < 3) continue;

        // Scan neighbor remotes using Event Log radar (intel and hostilesByRoom)
        const exits = Game.map.describeExits(homeRoomName);
        if (exits) {
            for (const direction in exits) {
                const targetRoomName = exits[direction];
                const hostiles = global.State.hostilesByRoom.get(targetRoomName) || new Map();
                let enemyHarvester = null;
                let enemyDefender = null;

                for (const hostile of hostiles.values()) {
                    let isDangerous = false;
                    let isHarvester = false;
                    if (global.State.enemyProfiles && global.State.enemyProfiles.has(hostile.id)) {
                        isDangerous = global.State.enemyProfiles.get(hostile.id).isDangerous;
                    }
                    if (hostile.body) {
                        for (let i=0; i<hostile.body.length; i++) {
                            if (hostile.body[i].type === WORK) isHarvester = true;
                            if (hostile.body[i].type === ATTACK || hostile.body[i].type === RANGED_ATTACK || hostile.body[i].type === HEAL) isDangerous = true;
                        }
                    } else {
                        isDangerous = true;
                    }

                    if (isDangerous) enemyDefender = hostile;
                    if (isHarvester && !isDangerous) enemyHarvester = hostile;
                }

                // If an unarmored enemy harvester is detected in a remote room without a defender, execute Poaching logic.
                if (enemyHarvester && !enemyDefender) {
                    let poacherExists = false;
                    const poachers = roomCreeps.get('poacher') || [];
                    for (const p of poachers) {
                        if (p.memory.targetRoom === targetRoomName) {
                            poacherExists = true;
                            break;
                        }
                    }

                    if (!poacherExists && SpawnQueueManager.getQueuedCarryParts(homeRoomName, 'poacher', targetRoomName) === 0) {
                        // Spawn one cheap [MOVE, ATTACK] creep to kill the harvester.
                        const cost = BODYPART_COST[MOVE] + BODYPART_COST[ATTACK];
                        if (room.energyCapacityAvailable >= cost) {
                            SpawnQueueManager.requestSpawn(homeRoomName, 'poacher', [MOVE, ATTACK], 'poacher_' + Game.time, {
                                memory: { role: 'poacher', colony: homeRoomName, targetRoom: targetRoomName }
                            }, cost);
                        }
                    }
                }

                // Once the harvester is dead (creating a tombstone), spawn a [CARRY, MOVE] looter
                const tombstones = global.State.tombstonesByRoom.get(targetRoomName);
                let hasLoot = false;
                if (tombstones) {
                    for (const t of tombstones.values()) {
                        if (t.store && t.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                            hasLoot = true;
                            break;
                        }
                    }
                }

                if (hasLoot && !enemyDefender) {
                    let looterExists = false;
                    const looters = roomCreeps.get('looter') || [];
                    for (const l of looters) {
                        if (l.memory.targetRoom === targetRoomName) {
                            looterExists = true;
                            break;
                        }
                    }

                    if (!looterExists && SpawnQueueManager.getQueuedCarryParts(homeRoomName, 'looter', targetRoomName) === 0) {
                        const cost = BODYPART_COST[CARRY] + BODYPART_COST[MOVE];
                        if (room.energyCapacityAvailable >= cost) {
                            SpawnQueueManager.requestSpawn(homeRoomName, 'looter', [CARRY, MOVE], 'looter_' + Game.time, {
                                memory: { role: 'looter', colony: homeRoomName, targetRoom: targetRoomName }
                            }, cost);
                        }
                    }
                }
            }
        }

        const poachers = roomCreeps.get('poacher') || [];
        for (const poacher of poachers) {
            if (poacher.fatigue > 0) continue;
            const targetRoomName = poacher.memory.targetRoom;
            if (poacher.room.name !== targetRoomName) {
                poacher.moveTo(new RoomPosition(25, 25, targetRoomName));
            } else {
                const hostiles = global.State.hostilesByRoom.get(targetRoomName) || new Map();
                const target = CombatManager.getBestTarget(poacher, Array.from(hostiles.values()));
                if (target) {
                    if (poacher.attack(target) === ERR_NOT_IN_RANGE) {
                        poacher.moveTo(target);
                    }
                }
            }
        }

        // Execute looter logic
        const looters = roomCreeps.get('looter') || [];
        for (const looter of looters) {
            if (looter.fatigue > 0) continue;
            
            const targetRoomName = looter.memory.targetRoom;
            const colonyRoomName = looter.memory.colony;

            if (looter.store.getFreeCapacity() === 0 || (looter.store.getUsedCapacity() > 0 && looter.room.name === colonyRoomName)) {
                if (looter.room.name !== colonyRoomName) {
                    looter.moveTo(new RoomPosition(25, 25, colonyRoomName));
                } else {
                    const storage = Game.rooms[colonyRoomName].storage;
                    const spawn = global.State.spawnsByRoom.get(colonyRoomName)?.[0];
                    const target = storage || spawn;
                    if (target) {
                        if (looter.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                            looter.moveTo(target);
                        }
                    }
                }
            } else {
                if (looter.room.name !== targetRoomName) {
                    looter.moveTo(new RoomPosition(25, 25, targetRoomName));
                } else {
                    const tombstones = global.State.tombstonesByRoom.get(targetRoomName);
                    let target = null;
                    if (tombstones) {
                        for (const t of tombstones.values()) {
                            if (t.store && t.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                                target = t;
                                break;
                            }
                        }
                    }
                    if (target) {
                        if (looter.withdraw(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                            looter.moveTo(target);
                        }
                    } else {
                        const dropped = global.State.droppedByRoom.get(targetRoomName);
                        if (dropped) {
                            for (const d of dropped.values()) {
                                if (d.resourceType === RESOURCE_ENERGY && d.amount > 0) {
                                    target = d;
                                    break;
                                }
                            }
                        }
                        if (target) {
                            if (looter.pickup(target) === ERR_NOT_IN_RANGE) {
                                looter.moveTo(target);
                            }
                        } else if (looter.store.getUsedCapacity() > 0) {
                            looter.moveTo(new RoomPosition(25, 25, colonyRoomName));
                        }
                    }
                }
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
