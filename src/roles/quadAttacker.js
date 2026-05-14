/**
 * @file quadAttacker.js
 * @description Atomic lockstep movement. Works with quadHealer.
 */

const movement = require('../utils/movement');
const CombatManager = require('../managers/CombatManager');

module.exports = {
    /**
     * Executes logic for quadAttacker role.
     * @param {Room} room
     */
    run(room) {
        const roomCreeps = global.State.creepsByRoom.get(room.name);
        if (!roomCreeps) return;

        const quadAttackers = roomCreeps.get('quadAttacker');
        if (!quadAttackers || quadAttackers.length === 0) return;

        const hostiles = global.State.hostilesByRoom ? (global.State.hostilesByRoom.get(room.name) || []) : [];

        const roomStructures = global.State.structuresByRoom ? (global.State.structuresByRoom.get(room.name) || new Map()) : new Map();
        const towers = roomStructures.get(STRUCTURE_TOWER) || [];
        const enemyTowers = [];
        for (let i = 0; i < towers.length; i++) {
            if (!towers[i].my) {
                enemyTowers.push(towers[i]);
            }
        }

        for (const creep of quadAttackers) {
            try {
                if (creep.fatigue > 0) continue; // Fatigue gating

                // Predictive Pre-Healing
                CombatManager.predictivePreHeal(creep, enemyTowers, hostiles);

                // Implementation placeholder
            } catch (e) {
                console.error(`[quadAttacker Error] Room ${room.name}, Creep ${creep.name}: ${e.stack}`);
            }
        }
    }
};
