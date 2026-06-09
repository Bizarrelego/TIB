/**
 * Top-Down Tower Manager
 * Evaluates room state once per tick to issue commands to all towers.
 */
class TowerManager {
    static run() {
        if (!global.State || !global.State.rooms) return;

        for (const [roomName, roomState] of global.State.rooms) {
            if (!roomState.towers || roomState.towers.length === 0) continue;

            const towers = [];
            for (let i = 0; i < roomState.towers.length; i++) {
                const t = roomState.towers[i];
                if (t.my && t.store.getUsedCapacity(RESOURCE_ENERGY) >= 10) {
                    towers.push(t);
                }
            }
            if (towers.length === 0) continue;

            // 1. Defense: Attack hostiles
            if (roomState.hostiles && roomState.hostiles.length > 0) {
                // Focus fire on the first hostile (IntelManager populates this)
                const target = roomState.hostiles[0]; 
                for (let i = 0; i < towers.length; i++) {
                    towers[i].attack(target);
                }
                continue; // Towers are busy defending
            }

            const room = Game.rooms[roomName];
            if (!room) continue;

            // 1.5 Emergency Maintenance: Repair critically damaged ramparts/walls (< 10,000 HP) immediately
            let emergencyTarget = null;
            if (roomState.repairTargets && roomState.repairTargets.length > 0) {
                for (let i = 0; i < roomState.repairTargets.length; i++) {
                    const t = roomState.repairTargets[i];
                    if ((t.structureType === STRUCTURE_RAMPART || t.structureType === STRUCTURE_WALL) && t.hits < 10000) {
                        if (!emergencyTarget || t.hits < emergencyTarget.hits) {
                            emergencyTarget = t;
                        }
                    }
                }
            }
            if (emergencyTarget) {
                for (let i = 0; i < towers.length; i++) {
                    towers[i].repair(emergencyTarget);
                }
                continue; // Towers are busy with emergency repair
            }

            // 2. Healing: Heal any damaged friendly creeps (from global state, no room.find)
            let damagedTarget = null;
            if (roomState.creeps) {
                for (let i = 0; i < roomState.creeps.length; i++) {
                    const c = roomState.creeps[i];
                    if (c.my && c.hits < c.hitsMax - 100) {
                        damagedTarget = c;
                        break;
                    }
                }
            }
            if (damagedTarget) {
                for (let i = 0; i < towers.length; i++) {
                    towers[i].heal(damagedTarget);
                }
                continue; // Towers are busy healing
            }

            // 3. Maintenance: Repair critical structures and ramparts
            for (let i = 0; i < towers.length; i++) {
                const tower = towers[i];
                // Only repair if energy is > 50% to reserve for defense
                if (tower.store.getUsedCapacity(RESOURCE_ENERGY) < 500) continue;

                if (roomState.repairTargets && roomState.repairTargets.length > 0) {
                    // Find lowest hit structure from pre-scanned repair targets
                    let target = roomState.repairTargets[0];
                    for (let j = 1; j < roomState.repairTargets.length; j++) {
                        if (roomState.repairTargets[j].hits < target.hits) target = roomState.repairTargets[j];
                    }
                    tower.repair(target);
                }
            }
        }
    }
}

module.exports = TowerManager;
