/**
 * @file burstFireController.js
 * @description Implement a logic layer to synchronize attack intents across squad members.
 */

const { isFatigued } = require('../utils/fatigueGating');
const TrafficManager = require('../traffic/trafficManager');

/**
 * @typedef {Object} CombatIntent
 * @property {string} creep - The name of the creep executing the action.
 * @property {string} action - The action to perform (e.g., 'attack', 'rangedAttack', 'heal', 'rangedHeal', 'move', 'rangedMassAttack', 'flee', 'borderBounce').
 * @property {string|Object} [target] - The ID of the target, or a RoomPosition object for movement/fleeing, or string for room names.
 */

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
        if (!squad || squad.length === 0 || !target || !target.pos) return;

        let allReady = true;

        // First pass: verify if all members are in range and not fatigued
        for (let i = 0; i < squad.length; i++) {
            const creep = squad[i];

            if (isFatigued(creep)) {
                allReady = false;
                break;
            }

            const distance = Math.max(
                Math.abs(creep.pos.x - target.pos.x),
                Math.abs(creep.pos.y - target.pos.y)
            );

            const hasRanged = creep.getActiveBodyparts(RANGED_ATTACK) > 0;
            const hasMelee = creep.getActiveBodyparts(ATTACK) > 0;

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

        const intents = [];

        // Second pass: generate intents
        for (let i = 0; i < squad.length; i++) {
            const creep = squad[i];

            if (allReady) {
                const distance = Math.max(
                    Math.abs(creep.pos.x - target.pos.x),
                    Math.abs(creep.pos.y - target.pos.y)
                );
                const hasMelee = creep.getActiveBodyparts(ATTACK) > 0;
                const hasRanged = creep.getActiveBodyparts(RANGED_ATTACK) > 0;

                if (hasMelee && distance <= 1) {
                    intents.push({ creep: creep.name, action: 'attack', target: target.id });
                } else if (hasRanged && distance <= 3) {
                    intents.push({ creep: creep.name, action: 'rangedAttack', target: target.id });
                }
            } else {
                // Not ready to burst fire, move closer if not fatigued
                if (!isFatigued(creep)) {
                    intents.push({ creep: creep.name, action: 'move', target: target.pos });
                }
            }
        }

        // Convert the array of intents into a Map to fulfill the V8 Map Optimization constraint
        const intentMap = new Map();
        for (let i = 0; i < intents.length; i++) {
            intentMap.set(intents[i].creep, intents[i]);
        }

        // Iterate over the squad instead of raw intents to enforce intent map lookup
        for (let i = 0; i < squad.length; i++) {
            const creep = squad[i];
            const intent = intentMap.get(creep.name);

            if (!intent) continue;

            if (intent.action === 'attack') {
                creep.attack(target);
            } else if (intent.action === 'rangedAttack') {
                creep.rangedAttack(target);
            } else if (intent.action === 'move') {
                TrafficManager.registerMoveIntent(creep, intent.target);
            }
        }
    }
}

module.exports = BurstFireController;
