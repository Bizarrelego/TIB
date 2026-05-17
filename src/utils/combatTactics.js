/**
 * @file combatTactics.js
 * @description Standalone utility for calculating combat-specific maneuvers and predictions.
 */

/**
 * Calculates the adjacent rooms a creep can bounce to from the given room.
 * @param {string} roomName - The name of the room to calculate exits for.
 * @returns {string[]} An array of adjacent room names.
 */
function calculateBorderBounce(roomName) {
    if (typeof Game === 'undefined' || !Game.map) return [];

    const exits = Game.map.describeExits(roomName);
    if (!exits) return [];

    const bounceTargets = [];
    for (const direction in exits) {
        bounceTargets.push(exits[direction]);
    }

    return bounceTargets;
}

/**
 * Determines if a target requires predictive healing based on damage or nearby hostile threats.
 * @param {Creep} target - The creep to evaluate for predictive healing.
 * @returns {boolean} True if the target needs healing or is in immediate danger.
 */
function shouldPredictiveHeal(target) {
    if (!target || !target.pos || !target.pos.roomName) return false;

    // Already damaged
    if (target.hits < target.hitsMax) {
        return true;
    }

    // Check for hostiles in the room via State
    if (!global.State || !global.State.hostilesByRoom) return false;

    const hostiles = global.State.hostilesByRoom.get(target.pos.roomName) || [];

    for (let i = 0; i < hostiles.length; i++) {
        const hostile = hostiles[i];

        // Calculate Chebyshev distance
        const distance = Math.max(
            Math.abs(target.pos.x - hostile.pos.x),
            Math.abs(target.pos.y - hostile.pos.y)
        );

        // If within threat range (<= 3 tiles)
        if (distance <= 3) {
            let isDangerous = false;

            if (hostile.body) {
                for (let j = 0; j < hostile.body.length; j++) {
                    const type = hostile.body[j].type;
                    if (type === ATTACK || type === RANGED_ATTACK) {
                        isDangerous = true;
                        break;
                    }
                }
            } else {
                // If body parts are not visible, assume dangerous if within range
                isDangerous = true;
            }

            if (isDangerous) {
                return true;
            }
        }
    }

    return false;
}

module.exports = {
    calculateBorderBounce,
    shouldPredictiveHeal
};
