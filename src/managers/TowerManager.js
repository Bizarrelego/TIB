/**
 * Top-Down Tower Manager
 * Evaluates room state once per tick to issue commands to all towers.
 */
class TowerManager {
    static run() {
        if (!global.State || !global.State.rooms) return;

        global.State.rooms.forEach((roomState, roomName) => {
            if (!roomState.towers || roomState.towers.length === 0) return;

            const towers = roomState.towers.filter(t => t.my && t.store.getUsedCapacity(RESOURCE_ENERGY) >= 10);
            if (towers.length === 0) return;

            // 1. Defense: Attack hostiles
            if (roomState.hostiles && roomState.hostiles.length > 0) {
                // Focus fire on the first hostile (IntelManager populates this)
                const target = roomState.hostiles[0]; 
                for (let i = 0; i < towers.length; i++) {
                    towers[i].attack(target);
                }
                return; // Towers are busy defending
            }

            const room = Game.rooms[roomName];
            if (!room) return;

            // 2. Healing: Heal any damaged friendly creeps (from global state, no room.find)
            const damagedCreeps = roomState.creeps ? roomState.creeps.filter(c => c.my && c.hits < c.hitsMax) : [];
            if (damagedCreeps.length > 0) {
                const target = damagedCreeps[0];
                for (let i = 0; i < towers.length; i++) {
                    towers[i].heal(target);
                }
                return; // Towers are busy healing
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
        });
    }
}

module.exports = TowerManager;
