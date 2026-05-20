/**
 * @file CombatTacticsEngine.js
 * @description Encapsulates the decision-making logic for advanced combat maneuvers
 * like Synchronized Burst Fire, Ranged Mass Attack (RMA) Spacing, Predictive Pre-Healing,
 * and Border Bouncing (I-Frames). Returns action recommendations (intents) rather than
 * directly modifying creep state.
 */

const { calculateBorderBounce, shouldPredictiveHeal } = require('./combatTactics');
const { isFatigued } = require('./fatigueGating');

/**
 * @typedef {Object} CombatIntent
 * @property {string} creep - The name of the creep executing the action.
 * @property {string} action - The action to perform (e.g., 'attack', 'rangedAttack', 'heal', 'rangedHeal', 'move', 'rangedMassAttack', 'flee', 'borderBounce').
 * @property {string|Object} [target] - The ID of the target, or a RoomPosition object for movement/fleeing, or string for room names.
 */

/**
 * Plans a Synchronized Burst Fire attack. Attackers hold fire until ready, hitting the target
 * on the exact same tick to out-pace tower healing.
 *
 * @param {Creep[]} attackers - An array of attacker creeps.
 * @param {Creep|Structure} target - The target to attack.
 * @returns {CombatIntent[]} An array of recommended intents for the attackers.
 */
function planBurstFire(attackers, target) {
    if (!attackers || attackers.length === 0 || !target || !target.pos) return [];

    const intents = [];
    let allReady = true;

    // Check if all attackers are in range and not fatigued
    for (let i = 0; i < attackers.length; i++) {
        const attacker = attackers[i];
        if (isFatigued(attacker)) {
            allReady = false;
            break;
        }

        const distance = Math.max(
            Math.abs(attacker.pos.x - target.pos.x),
            Math.abs(attacker.pos.y - target.pos.y)
        );

        const hasRanged = attacker.getActiveBodyparts(RANGED_ATTACK) > 0;
        const hasMelee = attacker.getActiveBodyparts(ATTACK) > 0;

        let inRange = false;
        if (hasMelee && distance <= 1) {
            inRange = true;
        } else if (hasRanged && distance <= 3) {
            inRange = true;
        }

        if (!inRange) {
            allReady = false;
            break;
        }
    }

    for (let i = 0; i < attackers.length; i++) {
        const attacker = attackers[i];

        if (allReady) {
            const distance = Math.max(
                Math.abs(attacker.pos.x - target.pos.x),
                Math.abs(attacker.pos.y - target.pos.y)
            );
            const hasMelee = attacker.getActiveBodyparts(ATTACK) > 0;
            const hasRanged = attacker.getActiveBodyparts(RANGED_ATTACK) > 0;

            if (hasMelee && distance <= 1) {
                intents.push({ creep: attacker.name, action: 'attack', target: target.id });
            } else if (hasRanged && distance <= 3) {
                intents.push({ creep: attacker.name, action: 'rangedAttack', target: target.id });
            }
        } else {
            // Not ready to burst fire, move closer if not fatigued
            if (!isFatigued(attacker)) {
                intents.push({ creep: attacker.name, action: 'move', target: target.pos });
            }
        }
    }

    return intents;
}

/**
 * Plans Ranged Mass Attack (RMA) Spacing. Creeps maintain Range 2 or 3 to hit all members
 * of an enemy group with RMA without taking melee damage.
 *
 * @param {Creep[]} rangedCreeps - An array of ranged creeps.
 * @param {Creep[]} enemyGroup - An array of enemy creeps.
 * @returns {CombatIntent[]} An array of recommended intents.
 */
function planRMA(rangedCreeps, enemyGroup) {
    if (!rangedCreeps || rangedCreeps.length === 0 || !enemyGroup || enemyGroup.length === 0) return [];

    const intents = [];

    for (let i = 0; i < rangedCreeps.length; i++) {
        const creep = rangedCreeps[i];
        let shouldRMA = false;
        let tooClose = false;
        let closestEnemyPos = null;
        let minDistance = Infinity;

        for (let j = 0; j < enemyGroup.length; j++) {
            const enemy = enemyGroup[j];
            if (enemy.pos.roomName !== creep.pos.roomName) continue;

            const distance = Math.max(
                Math.abs(creep.pos.x - enemy.pos.x),
                Math.abs(creep.pos.y - enemy.pos.y)
            );

            if (distance <= 3) {
                shouldRMA = true;
            }
            if (distance <= 1) {
                tooClose = true;
            }
            if (distance < minDistance) {
                minDistance = distance;
                closestEnemyPos = enemy.pos;
            }
        }

        if (shouldRMA) {
            intents.push({ creep: creep.name, action: 'rangedMassAttack' });
        }

        // Handle movement
        if (!isFatigued(creep)) {
            if (tooClose && closestEnemyPos) {
                // Flee from melee range
                intents.push({ creep: creep.name, action: 'flee', target: closestEnemyPos });
            } else if (!shouldRMA && closestEnemyPos) {
                // Move closer to be in range 3
                intents.push({ creep: creep.name, action: 'move', target: closestEnemyPos });
            }
        }
    }

    return intents;
}

/**
 * Plans Predictive Pre-Healing. Assesses enemy tower target logic and heals on the same tick damage
 * connects to survive one-shots.
 *
 * @param {Creep[]} healers - An array of healer creeps.
 * @param {Creep} targetCreep - The creep that needs healing.
 * @param {number} [expectedDamage=0] - The anticipated damage the target will take this tick from creeps.
 * @returns {CombatIntent[]} An array of recommended intents.
 */
function predictiveHeal(healers, targetCreep, expectedDamage = 0) {
    if (!healers || healers.length === 0 || !targetCreep || !targetCreep.pos) return [];

    const intents = [];

    // Assess enemy tower target logic and calculate expected tower damage
    let towerDamage = 0;
    if (global.State && global.State.structuresByRoom) {
        const structures = global.State.structuresByRoom.get(targetCreep.pos.roomName) || [];
        for (let i = 0; i < structures.length; i++) {
            const struct = structures[i];
            // If structure is a hostile tower with at least 10 energy (TOWER_ENERGY_COST)
            if (struct.structureType === 'tower' && struct.my === false && struct.store && struct.store.energy >= 10) {
                const distance = Math.max(
                    Math.abs(struct.pos.x - targetCreep.pos.x),
                    Math.abs(struct.pos.y - targetCreep.pos.y)
                );

                // Screeps logic: TOWER_POWER_ATTACK = 600, TOWER_OPTIMAL_RANGE = 5, TOWER_FALLOFF_RANGE = 20, TOWER_FALLOFF = 0.75
                if (distance <= 5) {
                    towerDamage += 600;
                } else if (distance >= 20) {
                    towerDamage += 150;
                } else {
                    towerDamage += 600 - (600 * 0.75 * (distance - 5) / 15);
                }
            }
        }
    }

    const totalExpectedDamage = expectedDamage + towerDamage;

    // Use shouldPredictiveHeal from combatTactics or totalExpectedDamage threshold
    const needsHeal = totalExpectedDamage > 0 || shouldPredictiveHeal(targetCreep);

    if (needsHeal) {
        for (let i = 0; i < healers.length; i++) {
            const healer = healers[i];
            const distance = Math.max(
                Math.abs(healer.pos.x - targetCreep.pos.x),
                Math.abs(healer.pos.y - targetCreep.pos.y)
            );

            if (distance <= 1) {
                intents.push({ creep: healer.name, action: 'heal', target: targetCreep.id });
            } else if (distance <= 3) {
                intents.push({ creep: healer.name, action: 'rangedHeal', target: targetCreep.id });
                if (!isFatigued(healer)) {
                    intents.push({ creep: healer.name, action: 'move', target: targetCreep.pos });
                }
            } else {
                if (!isFatigued(healer)) {
                    intents.push({ creep: healer.name, action: 'move', target: targetCreep.pos });
                }
            }
        }
    }

    return intents;
}

/**
 * Plans Border Bouncing (I-Frames). Step into adjacent rooms to drop aggro, dodge projectiles, and heal safely.
 *
 * @param {Creep} creep - The creep to plan border bouncing for.
 * @returns {CombatIntent[]} An array of recommended intents.
 */
function planBorderBounce(creep) {
    if (!creep || !creep.pos || isFatigued(creep)) return [];

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
        const hostiles = global.State.hostilesByRoom.get(roomName) || [];
        for (let i = 0; i < hostiles.length; i++) {
            const hostile = hostiles[i];
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
                            if (part.type === RANGED_ATTACK && distance <= 3) {
                                incomingDamage += 10; // Standard is 10, RMA varies but 10 is a safe maximum estimate
                            }
                        }
                    }
                } else {
                    // if no body visibility, assume a scary amount
                    incomingDamage += 30;
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
    // Beneficial if we will die, or if we take more damage than we can heal
    const willDie = (creep.hits + availableHealing) <= incomingDamage;
    const takingNetDamage = incomingDamage > availableHealing;

    // If not taking net damage and not going to die, we don't need to bounce
    if (!willDie && !takingNetDamage) {
        return [];
    }

    // If beneficial, find the closest exit tile
    if (global.State && global.State.roomExits && global.State.roomExits.has(roomName)) {
        const roomExitsMap = global.State.roomExits.get(roomName);
        let closestExit = null;
        let minDistance = Infinity;

        for (const exits of roomExitsMap.values()) {
            for (let i = 0; i < exits.length; i++) {
                const exitPos = exits[i];
                const dx = Math.abs(exitPos.x - creep.pos.x);
                const dy = Math.abs(exitPos.y - creep.pos.y);
                const distance = dx + dy; // Manhattan is fine for closest
                if (distance < minDistance) {
                    minDistance = distance;
                    closestExit = exitPos;
                }
            }
        }

        if (closestExit) {
            return [{ creep: creep.name, action: 'move', target: closestExit }];
        }
    }

    // Fallback to calculating the adjacent room names and returning a borderBounce action
    const bounceTargets = calculateBorderBounce(roomName);
    if (bounceTargets.length > 0) {
        return [{ creep: creep.name, action: 'borderBounce', target: bounceTargets[0] }];
    }

    return [];
}

/**
 * Plans Kiting away from dangerous hostiles. Returns an intent to move away
 * if enemies are too close.
 *
 * @param {Creep} creep - The creep to plan kiting for.
 * @param {Creep[]} hostiles - The array of hostiles in the room.
 * @returns {CombatIntent[]} An array of recommended intents.
 */
function planKite(creep, hostiles) {
    if (isFatigued(creep) || !hostiles || hostiles.length === 0) return [];

    let totalFleeX = 0;
    let totalFleeY = 0;
    let dangerFound = false;

    for (let i = 0; i < hostiles.length; i++) {
        const hostile = hostiles[i];
        let isDangerous = true;

        if (global.State && global.State.enemyProfiles && global.State.enemyProfiles.has(hostile.id)) {
            isDangerous = global.State.enemyProfiles.get(hostile.id).isDangerous;
        }

        if (isDangerous) {
            const range = Math.max(
                Math.abs(creep.pos.x - hostile.pos.x),
                Math.abs(creep.pos.y - hostile.pos.y)
            );

            if (range <= 4) {
                dangerFound = true;
                const dx = creep.pos.x - hostile.pos.x;
                const dy = creep.pos.y - hostile.pos.y;
                const weight = 5 - range;

                totalFleeX += (dx === 0 ? 0 : Math.sign(dx)) * weight;
                totalFleeY += (dy === 0 ? 0 : Math.sign(dy)) * weight;
            }
        }
    }

    if (dangerFound) {
        let targetX = creep.pos.x + totalFleeX;
        let targetY = creep.pos.y + totalFleeY;

        targetX = Math.max(1, Math.min(48, targetX));
        targetY = Math.max(1, Math.min(48, targetY));

        const fleePos = new RoomPosition(Math.floor(targetX), Math.floor(targetY), creep.pos.roomName);
        return [{ creep: creep.name, action: 'flee', target: fleePos }];
    }

    return [];
}

module.exports = {
    planBurstFire,
    planRMA,
    predictiveHeal,
    planBorderBounce,
    planKite
};
