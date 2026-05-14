/**
 * @file offense.js
 * @description Manages combat & siege execution.
 */

const CombatManager = require('../managers/CombatManager');

function runAtomicQuads() {
    if (!global.State || !global.State.activeQuads) return;

    for (const [, quadObj] of global.State.activeQuads) {
        if (!quadObj.creeps || quadObj.creeps.length === 0) continue;

        // Find direction (placeholder logic, usually fetched from quadObj.target or pathing)
        const direction = quadObj.direction || TOP;

        CombatManager.atomicQuadMove(quadObj.creeps, direction);
    }
}

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

function runTowerDrain() {
    if (!global.State || !global.State.creepsByRoom) return;

    for (const [roomName, roomCreeps] of global.State.creepsByRoom) {
        const drainers = roomCreeps.get('drainerHunter') || [];
        if (drainers.length === 0) continue;

        const roomStructures = global.State.structuresByRoom ? global.State.structuresByRoom.get(roomName) || new Map() : new Map();
        const towers = roomStructures.get(STRUCTURE_TOWER) || [];
        const enemyTowers = towers.filter(t => !t.my);

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

module.exports = function offenseManager() {
    try {
        // Execute heavy combat logic
        runAtomicQuads();
        runSynchronizedBurst();
        runTowerDrain();
    } catch (e) {
        console.error(`[OffenseManager Error] ${e.stack}`);
    }
};
