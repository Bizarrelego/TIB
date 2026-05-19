/**
 * @file burstFireController.js
 * @description Implement a logic layer to synchronize attack intents across squad members.
 */

const { planBurstFire } = require('../utils/CombatTacticsEngine');

/**
 * Controller for synchronized burst fire attacks.
 */
class BurstFireController {
    /**
     * Executes a synchronized burst fire attack.
     * All squad members hold fire until the target is in range for all units.
     * Executes all attack intents on the same tick.
     *
     * @param {Creep[]} squad - The squad of attacking creeps.
     * @param {Creep|Structure} target - The target to attack.
     */
    static execute(squad, target) {
        if (!squad || squad.length === 0 || !target) return;

        const intents = planBurstFire(squad, target);

        for (let i = 0; i < intents.length; i++) {
            const intent = intents[i];
            const creep = Game.creeps[intent.creep];
            if (!creep) continue;

            if (intent.action === 'attack') {
                creep.attack(target);
            } else if (intent.action === 'rangedAttack') {
                creep.rangedAttack(target);
            } else if (intent.action === 'move') {
                creep.moveTo(intent.target);
            }
        }
    }
}

module.exports = BurstFireController;
