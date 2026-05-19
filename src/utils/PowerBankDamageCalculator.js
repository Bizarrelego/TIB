/**
 * @file PowerBankDamageCalculator.js
 * @description Utility for calculating required attack and heal bodies for power bank cracking.
 */

class PowerBankDamageCalculator {
    /**
     * Calculates the dynamically exact bodies required to break a power bank.
     * @param {number} bankHits - Remaining hits of the power bank
     * @param {number} bankTicks - Ticks to decay of the power bank
     * @param {number} travelDist - Distance from spawn to power bank
     * @param {number} energyCapacity - Energy capacity available for spawning
     * @returns {Object|null} { attackerBody, healerBody, attackerCost, healerCost }
     */
    static calculateSiege(bankHits, bankTicks, travelDist, energyCapacity) {
        // Assume life time of 1500, subtract travel ticks
        const ticksAvailable = Math.min(bankTicks, 1500) - (travelDist * 50);
        if (ticksAvailable <= 0) return null;

        // Damage required per tick to kill bank before it decays
        const requiredDpt = Math.ceil(bankHits / ticksAvailable);

        // 1 ATTACK deals 30 damage.
        let requiredAttackParts = Math.ceil(requiredDpt / 30);

        // We cap attack parts at 20 so a single healer can keep up with the reflect damage.
        // If we need more than 20, they can't break it in one pair anyway without timing out.
        if (requiredAttackParts > 20) {
             requiredAttackParts = 20;
        }

        // Reflected damage is 50% of dealt damage.
        // Example: 20 ATTACK * 30 dmg = 600 dealt. 300 reflected.
        // 1 HEAL heals 12 damage.
        const reflectDamage = requiredAttackParts * 30 * 0.5;
        const requiredHealParts = Math.ceil(reflectDamage / 12);

        // Provide enough move parts to keep them fast on roads (or off-road for lower sizes)
        // Simplest math: 1 MOVE per part for 1 tick movement off-road, or 1 MOVE per 2 parts for 1 tick on roads.
        // We will default to 1 MOVE per WORK/HEAL/ATTACK for maximum mobility.
        const attackMove = requiredAttackParts;
        const healMove = requiredHealParts;

        if (requiredAttackParts + attackMove > 50 || requiredHealParts + healMove > 50) {
            return null; // Exceeds max body size
        }

        const attackerCost = requiredAttackParts * BODYPART_COST[ATTACK] + attackMove * BODYPART_COST[MOVE];
        const healerCost = requiredHealParts * BODYPART_COST[HEAL] + healMove * BODYPART_COST[MOVE];

        // Ensure we can afford both independently (as they spawn separately)
        if (energyCapacity < attackerCost || energyCapacity < healerCost) {
            return null;
        }

        let attackerBody = [];
        let healerBody = [];

        for (let i = 0; i < requiredAttackParts; i++) attackerBody.push(ATTACK);
        for (let i = 0; i < attackMove; i++) attackerBody.push(MOVE);

        for (let i = 0; i < requiredHealParts; i++) healerBody.push(HEAL);
        for (let i = 0; i < healMove; i++) healerBody.push(MOVE);

        return {
            attackerBody,
            healerBody,
            attackerCost,
            healerCost
        };
    }
}

module.exports = PowerBankDamageCalculator;
