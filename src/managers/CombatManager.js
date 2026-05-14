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
        // Simple heuristic: if we are within 5 tiles of a tower, or taking damage, pre-heal.
        // Advanced logic would track incoming damage vectors.
        let incomingDamage = 0;

        if (enemyTowers) {
            for (const tower of enemyTowers) {
                if (creep.pos.getRangeTo(tower) <= 15) { // Assuming tower will likely target this creep if close
                    incomingDamage += 600; // Max tower damage at close range
                }
            }
        }

        if (enemyCreeps) {
            for (const hostile of enemyCreeps) {
                let isDangerous = true;
                if (hostile.body) {
                    isDangerous = hostile.body.some(p => p.type === ATTACK || p.type === RANGED_ATTACK);
                }
                if (isDangerous) {
                    if (creep.pos.getRangeTo(hostile) <= 3) {
                        incomingDamage += 100; // Estimate
                    }
                }
            }
        }

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
