const ActionConstants = require('../constants/ActionConstants');

/**
 * Top-Down Tower Manager
 * Evaluates room state once per tick to issue commands to all towers.
 */
class TowerManager {
    static run() {
        if (!global.structureHeap) global.structureHeap = new Map();
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
                    let heap = global.structureHeap.get(towers[i].id) || {};
                    heap.actionIntent = ActionConstants.ACTION_ATTACK;
                    heap.targetId = target.id;
                    global.structureHeap.set(towers[i].id, heap);
                }
                continue; // Towers are busy defending
            }

            const room = Game.rooms[roomName];
            if (!room) continue;

            let towersAvailable = [...towers];

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
                for (let i = 0; i < towersAvailable.length; i++) {
                    let heap = global.structureHeap.get(towersAvailable[i].id) || {};
                    heap.actionIntent = ActionConstants.ACTION_REPAIR;
                    heap.targetId = emergencyTarget.id;
                    global.structureHeap.set(towersAvailable[i].id, heap);
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
            
            if (damagedTarget && towersAvailable.length > 0) {
                // One tower is usually enough to heal a creep unless it's under heavy fire, prevents energy drain overkill
                const healer = towersAvailable.shift();
                let heap = global.structureHeap.get(healer.id) || {};
                heap.actionIntent = ActionConstants.ACTION_HEAL;
                heap.targetId = damagedTarget.id;
                global.structureHeap.set(healer.id, heap);
            }

            if (towersAvailable.length === 0) continue;

            // 3. Maintenance: Repair critical structures and ramparts
            if (roomState.repairTargets && roomState.repairTargets.length > 0) {
                // Sort by lowest health
                roomState.repairTargets.sort((a, b) => a.hits - b.hits);
                let targetIdx = 0;

                for (let i = 0; i < towersAvailable.length; i++) {
                    const tower = towersAvailable[i];
                    // Only repair if energy is > 50% to reserve for defense
                    if (tower.store.getUsedCapacity(RESOURCE_ENERGY) < 500) continue;

                    const target = roomState.repairTargets[targetIdx];
                    if (!target) break;

                    let heap = global.structureHeap.get(tower.id) || {};
                    heap.actionIntent = ActionConstants.ACTION_REPAIR;
                    heap.targetId = target.id;
                    global.structureHeap.set(tower.id, heap);
                    
                    // Optimization: If target is a wall/rampart, keep hitting it with multiple towers.
                    // If it's a road/container, assign 1 tower per target to prevent massive energy overkill.
                    if (target.structureType !== STRUCTURE_WALL && target.structureType !== STRUCTURE_RAMPART) {
                        targetIdx++;
                    }
                }
            }
        }
    }
}

module.exports = TowerManager;
