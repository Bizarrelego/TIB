/**
 * @file borderBouncer.js
 * @description Implements the "Border Bouncing (I-Frames)" combat tactic.
 * This tactic allows a creep to temporarily leave a room to drop aggro, dodge projectiles, and heal safely.
 * Integration points: src/managers/CombatManager.js, src/utils/CombatTacticsEngine.js
 */

const { isFatigued } = require('../utils/fatigueGating');
const movement = require('../utils/movement');

/**
 * Determines if a creep should perform a border bounce based on incoming damage and available healing.
 * @param {Creep} creep - The creep to evaluate.
 * @returns {boolean} True if the creep should border bounce, false otherwise.
 */
function shouldBorderBounce(creep) {
    if (!creep || !creep.pos || isFatigued(creep)) return false;

    let incomingDamage = 0;
    const roomName = creep.pos.roomName;

    // Calculate expected tower damage
    if (global.State && global.State.structuresByRoom) {
        const roomStructures = global.State.structuresByRoom.get(roomName);
        if (roomStructures) {
            const towers = roomStructures.get('tower');
            if (towers) {
                for (const tower of towers.values()) {
                    if (tower.my === false && tower.store && tower.store.energy >= 10) {
                        const distance = Math.max(
                            Math.abs(tower.pos.x - creep.pos.x),
                            Math.abs(tower.pos.y - creep.pos.y)
                        );
                        if (distance <= 5) {
                            incomingDamage += 600;
                        } else if (distance >= 20) {
                            incomingDamage += 150;
                        } else {
                            incomingDamage += 600 - (600 * 0.75 * (distance - 5) / 15);
                        }
                    }
                }
            }
        }
    }

    // Calculate expected creep damage
    if (global.State && global.State.hostilesByRoom) {
        const hostilesMap = global.State.hostilesByRoom.get(roomName);
        if (hostilesMap) {
            for (const hostile of hostilesMap.values()) {
                const distance = Math.max(
                    Math.abs(hostile.pos.x - creep.pos.x),
                    Math.abs(hostile.pos.y - creep.pos.y)
                );

                if (distance <= 3) {
                    if (hostile.body) {
                        for (let j = 0; j < hostile.body.length; j++) {
                            const part = hostile.body[j];
                            if (part.hits > 0) {
                                if (part.type === ATTACK && distance <= 1) incomingDamage += 30; // ATTACK_POWER
                                if (part.type === RANGED_ATTACK && distance <= 3) incomingDamage += 10; // Standard is 10
                            }
                        }
                    } else {
                        // If no body visibility, assume a scary amount
                        incomingDamage += 30;
                    }
                }
            }
        }
    }

    // Calculate available healing
    let availableHealing = 0;

    // self healing
    if (creep.body) {
        for (let i = 0; i < creep.body.length; i++) {
            const part = creep.body[i];
            if (part.hits > 0 && part.type === HEAL) {
                availableHealing += 12; // HEAL_POWER
            }
        }
    }

    // allied healing
    if (global.State && global.State.creepsByRoom) {
        const roomCreeps = global.State.creepsByRoom.get(roomName);
        if (roomCreeps) {
            for (const creeps of roomCreeps.values()) {
                for (let i = 0; i < creeps.length; i++) {
                    const ally = creeps[i];
                    if (ally.name !== creep.name) {
                        const distance = Math.max(
                            Math.abs(ally.pos.x - creep.pos.x),
                            Math.abs(ally.pos.y - creep.pos.y)
                        );
                        if (distance <= 3) {
                            for (let j = 0; j < ally.body.length; j++) {
                                const part = ally.body[j];
                                if (part.hits > 0 && part.type === HEAL) {
                                    if (distance <= 1) availableHealing += 12; // HEAL_POWER
                                    else availableHealing += 4; // RANGED_HEAL_POWER
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Check if bounce is beneficial
    const willDie = (creep.hits + availableHealing) <= incomingDamage;
    const takingNetDamage = incomingDamage > availableHealing;

    return willDie || takingNetDamage;
}

/**
 * Calculates the safe adjacent room and position to bounce to.
 * Finds the adjacent room with the fewest hostiles and returns a position in that room.
 * @param {Creep} creep - The creep to evaluate.
 * @returns {RoomPosition|null} The target RoomPosition to bounce to, or null if none available.
 */
function getBorderBounceTarget(creep) {
    if (!creep || !creep.pos) return null;
    if (typeof Game === 'undefined' || !Game.map) return null;

    const currentRoom = creep.pos.roomName;
    const exits = Game.map.describeExits(currentRoom);

    if (!exits) return null;

    let safestRoom = null;
    let minHostiles = Infinity;

    for (const direction in exits) {
        const adjacentRoom = exits[direction];
        let hostileCount = 0;

        if (global.State && global.State.hostilesByRoom && global.State.hostilesByRoom.has(adjacentRoom)) {
            const hostilesMap = global.State.hostilesByRoom.get(adjacentRoom);
            if (hostilesMap) {
                hostileCount = hostilesMap.size;
            }
        }

        if (hostileCount < minHostiles) {
            minHostiles = hostileCount;
            safestRoom = adjacentRoom;
        }
    }

    if (safestRoom) {
        // Return a position inside the adjacent room so the creep actually leaves the current room
        return new RoomPosition(25, 25, safestRoom);
    }

    return null;
}

/**
 * Executes a border bounce if necessary by calculating the target and issuing a move intent.
 * @param {Creep} creep - The creep to evaluate and potentially move.
 * @returns {boolean} True if a border bounce intent was issued, false otherwise.
 */
function executeBorderBounce(creep) {
    if (shouldBorderBounce(creep)) {
        const target = getBorderBounceTarget(creep);
        if (target) {
            movement.moveTo(creep, target);
            return true;
        }
    }
    return false;
}

module.exports = {
    shouldBorderBounce,
    getBorderBounceTarget,
    executeBorderBounce
};
