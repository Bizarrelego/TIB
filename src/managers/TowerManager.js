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

            // 2. Healing: Heal any damaged friendly creeps
            const myCreeps = room.find(FIND_MY_CREEPS, { filter: c => c.hits < c.hitsMax });
            if (myCreeps.length > 0) {
                const target = myCreeps[0];
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

                // Scale rampart repair target by RCL
                const rcl = room.controller ? room.controller.level : 1;
                const rampartTargetHits = rcl * 50000;

                const structures = room.find(FIND_STRUCTURES, {
                    filter: (s) => {
                        if (s.structureType === STRUCTURE_RAMPART || s.structureType === STRUCTURE_WALL) {
                            return s.hits < rampartTargetHits;
                        }
                        return s.hits < s.hitsMax * 0.5; // Repair other structures if below 50%
                    }
                });

                if (structures.length > 0) {
                    // Find lowest hit structure
                    let target = structures[0];
                    for(let j=1; j<structures.length; j++){
                        if (structures[j].hits < target.hits) target = structures[j];
                    }
                    tower.repair(target);
                }
            }
        });
    }
}

module.exports = TowerManager;
