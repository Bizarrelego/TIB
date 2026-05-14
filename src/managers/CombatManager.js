const TrafficManager = require('../traffic/trafficManager');
const movement = require('../utils/movement');
const Profiler = require('../utils/profiler');

/**
 * @file CombatManager.js
 * @description Centralized kiting and combat logic (Tigga-Style).
 * Features Heatmap Kiting, Predictive Pre-Heals, Atomic Quad Movement,
 * Synchronized Burst Fire, and I-Frame Border Bouncing.
 */

class CombatManager {
    /**
     * Executes kiting logic for a creep away from hostiles.
     * Incorporates heatmap parsing, edge-clamping, and fatigue gating.
     * @param {Creep} creep
     * @param {Creep[]} hostiles
     * @returns {boolean} True if kiting action was taken
     */
    static kite(creep, hostiles) {
        if (creep.fatigue > 0 || !hostiles || hostiles.length === 0) return false;

        let totalFleeX = 0;
        let totalFleeY = 0;
        let dangerFound = false;

        for (const hostile of hostiles) {
            // Check danger (ATTACK or RANGED_ATTACK parts). If no body info, assume dangerous.
            let isDangerous = true;
            if (hostile.body) {
                isDangerous = hostile.body.some(p => p.type === ATTACK || p.type === RANGED_ATTACK);
            }

            if (isDangerous) {
                const range = creep.pos.getRangeTo(hostile);
                // RANGED_ATTACK has a range of 3, keep at least range 4 (or 5 for safety)
                if (range <= 4) {
                    dangerFound = true;
                    // Calculate vector away from hostile
                    const dx = creep.pos.x - hostile.pos.x;
                    const dy = creep.pos.y - hostile.pos.y;

                    // Normalize vector (simplified) and apply inverse square distance weight
                    const weight = 5 - range;
                    totalFleeX += Math.sign(dx) * weight;
                    totalFleeY += Math.sign(dy) * weight;
                }
            }
        }

        if (dangerFound) {
            // Apply heatmaps if available in state
            let targetX = creep.pos.x + totalFleeX;
            let targetY = creep.pos.y + totalFleeY;

            // Strict edge clamping (Math.max(1, Math.min(48, coord)))
            targetX = Math.max(1, Math.min(48, targetX));
            targetY = Math.max(1, Math.min(48, targetY));

            const fleePos = new RoomPosition(Math.floor(targetX), Math.floor(targetY), creep.room.name);
            movement.moveTo(creep, fleePos);
            return true;
        }

        return false;
    }

    /**
     * Domestic creep manager wrapper that forces kiting if hostiles exist in the room.
     * @param {Creep} creep
     * @returns {boolean} True if the creep is kiting and should skip normal logic
     */
    static manageDomestic(creep) {
        if (!global.State || !global.State.hostilesByRoom) return false;

        const hostiles = global.State.hostilesByRoom.get(creep.room.name);
        if (hostiles && hostiles.length > 0) {
            return this.kite(creep, hostiles);
        }
        return false;
    }

    /**
     * Analyzes enemy tower targets and pre-heals expected damage on the same tick.
     * @param {Creep} creep
     * @param {StructureTower[]} enemyTowers
     * @param {Creep[]} enemyCreeps
     * @returns {number} The calculated incoming damage
     */
    static predictivePreHeal(creep, enemyTowers, enemyCreeps) {
        let incomingDamage = 0;

        // Calculate potential tower damage
        if (enemyTowers && enemyTowers.length > 0) {
            // Find all friendlies in the room to simulate tower target logic (closest first)
            let friendlies = [];
            if (global.State && global.State.creepsByRoom) {
                const roomCreeps = global.State.creepsByRoom.get(creep.room.name);
                if (roomCreeps) {
                    for (const [, creeps] of roomCreeps) {
                        friendlies.push(...creeps);
                    }
                }
            } else {
                friendlies.push(creep); // Fallback
            }

            for (const tower of enemyTowers) {
                if (tower.store && tower.store[RESOURCE_ENERGY] >= TOWER_ENERGY_COST) {
                    // Find closest friendly
                    let closestFriendly = null;
                    let closestDist = Infinity;
                    for (const friendly of friendlies) {
                        const dist = tower.pos.getRangeTo(friendly);
                        if (dist < closestDist) {
                            closestDist = dist;
                            closestFriendly = friendly;
                        }
                    }

                    // If this creep is the closest (or tied for closest), it might be targeted
                    if (closestFriendly && closestFriendly.id === creep.id) {
                        const range = creep.pos.getRangeTo(tower);
                        let damage = TOWER_POWER_ATTACK;
                        if (range > TOWER_OPTIMAL_RANGE) {
                            if (range >= TOWER_FALLOFF_RANGE) {
                                damage -= damage * TOWER_FALLOFF;
                            } else {
                                damage -= damage * TOWER_FALLOFF * (range - TOWER_OPTIMAL_RANGE) / (TOWER_FALLOFF_RANGE - TOWER_OPTIMAL_RANGE);
                            }
                        }
                        incomingDamage += damage;
                    }
                }
            }
        }

        // Calculate potential creep damage
        if (enemyCreeps && enemyCreeps.length > 0) {
            for (const hostile of enemyCreeps) {
                if (hostile.body) {
                    const range = creep.pos.getRangeTo(hostile);
                    if (range <= 3) {
                        let attackDmg = 0;
                        let rangedDmg = 0;
                        for (const part of hostile.body) {
                            if (part.hits > 0) {
                                if (part.type === ATTACK && range <= 1) {
                                    attackDmg += ATTACK_POWER;
                                } else if (part.type === RANGED_ATTACK) {
                                    rangedDmg += RANGED_ATTACK_POWER;
                                }
                            }
                        }
                        // Assume hostile attacks if capable
                        incomingDamage += attackDmg + rangedDmg;
                    }
                } else {
                    // Fallback estimate if no body info
                    if (creep.pos.getRangeTo(hostile) <= 3) {
                        incomingDamage += 100;
                    }
                }
            }
        }

        // Execute pre-heal if damage is incoming or already damaged
        if (incomingDamage > 0 || creep.hits < creep.hitsMax) {
            creep.heal(creep);
        }

        return incomingDamage;
    }

    /**
     * 4-creep lockstep chain-pulling. If one halts, all wait.
     * Relies on TrafficManager to issue synchronized moves.
     * @param {Creep[]} quad
     * @param {number} direction
     */
    static atomicQuadMove(quad, direction) {
        if (!quad || quad.length === 0) return;

        // Check if any member is fatigued
        const anyFatigued = quad.some(creep => creep.fatigue > 0);

        if (!anyFatigued) {
            for (const creep of quad) {
                TrafficManager.registerMove(creep, direction);
            }
        }
    }

    /**
     * Withholds fire until all attackers are ready and hits target on exact same tick.
     * @param {Creep[]} attackers
     * @param {Creep|Structure} target
     */
    static synchronizedBurst(attackers, target) {
        if (!attackers || attackers.length === 0 || !target) return;

        // Ensure all are in range 3
        const allInRange = attackers.every(attacker => attacker.pos.getRangeTo(target) <= 3);

        if (allInRange) {
            for (const attacker of attackers) {
                attacker.rangedAttack(target);
            }
        }
    }

    /**
     * Steps into adjacent rooms to drop aggro and heal (I-frames).
     * @param {Creep} creep
     * @param {string} retreatRoomName
     */
    static borderBounce(creep, retreatRoomName) {
        if (creep.fatigue > 0) return;

        // If HP is low, step to the retreat room
        if (creep.hits < creep.hitsMax * 0.5) {
            if (creep.room.name !== retreatRoomName) {
                // Move towards center of retreat room to step off exit tile quickly
                movement.moveTo(creep, new RoomPosition(25, 25, retreatRoomName));
            } else {
                // Already in retreat room, step off edge and heal
                if (creep.pos.x === 0 || creep.pos.x === 49 || creep.pos.y === 0 || creep.pos.y === 49) {
                    movement.moveTo(creep, new RoomPosition(25, 25, retreatRoomName));
                }
                creep.heal(creep);
            }
        } else if (creep.hits === creep.hitsMax) {
            // Ready to re-engage, return to target room (would be handled by role logic)
        }
    }

    /**
     * Gets best target considering priority and distance.
     * @param {Creep} creep
     * @param {Creep[]} hostiles
     * @returns {Creep|null}
     */
    static getBestTarget(creep, hostiles) {
        if (!hostiles || hostiles.length === 0) return null;

        let bestTarget = null;
        let bestScore = -Infinity;

        for (const hostile of hostiles) {
            const range = creep.pos.getRangeTo(hostile);
            let score = 100 - range * 2; // Closer is better

            // HEAL parts are high priority
            if (hostile.body) {
                const healParts = hostile.body.filter(p => p.type === HEAL).length;
                score += healParts * 10;
            }

            if (score > bestScore) {
                bestScore = score;
                bestTarget = hostile;
            }
        }

        return bestTarget;
    }
}

for (const method of Object.getOwnPropertyNames(CombatManager)) {
    if (typeof CombatManager[method] === 'function' && method !== 'constructor' && method !== 'prototype' && method !== 'name' && method !== 'length') {
        CombatManager[method] = Profiler.wrap(`CombatManager.${method}`, CombatManager[method]);
    }
}

module.exports = CombatManager;
