const eventBus = require('../os/eventBus');

function getDistance(pos1, pos2) {
    return Math.max(Math.abs(pos1.x - pos2.x), Math.abs(pos1.y - pos2.y));
}

function run(room, defenseRepairTarget = null) {
    if (Game.cpu.bucket < 500) return;

    try {
        if (!global.State || !global.State.structuresByRoom) return;
        const structuresMap = global.State.structuresByRoom.get(room.name);
        if (!structuresMap) return;

        const towers = structuresMap.get(STRUCTURE_TOWER) || [];
        if (towers.length === 0) return;

        let targetHostile = null;
        const hostilesMap = global.State.hostilesByRoom ? global.State.hostilesByRoom.get(room.name) : null;
        if (hostilesMap && hostilesMap.size > 0) {
            const referencePos = towers[0].pos;
            let maxDanger = -1;
            let minDistance = Infinity;

            for (const hostile of hostilesMap.values()) {
                let danger = 10;
                let healParts = 0;
                let attackParts = 0;
                
                if (global.State && global.State.enemyProfiles && global.State.enemyProfiles.has(hostile.id)) {
                    const profile = global.State.enemyProfiles.get(hostile.id);
                    healParts = profile.healParts || 0;
                    attackParts = profile.attackParts || 0;
                }

                // Strict targeting array: Hostile Attackers > Hostile Healers
                if (attackParts > 0) danger = 100;
                else if (healParts > 0) danger = 50;

                const dist = getDistance(referencePos, hostile.pos);

                if (danger > maxDanger || (danger === maxDanger && dist < minDistance)) {
                    maxDanger = danger;
                    minDistance = dist;
                    targetHostile = hostile;
                }
            }
        }

        for (let i = 0; i < towers.length; i++) {
            const tower = towers[i];
            if (tower.store.getUsedCapacity(RESOURCE_ENERGY) >= 10 && targetHostile) {
                const dist = getDistance(tower.pos, targetHostile.pos);
                
                // Component 61: Tower Calculus (Damage vs. Heal)
                let damage = 150;
                if (dist > 5) {
                    if (dist > 20) {
                        damage = 60;
                    } else {
                        damage -= (dist - 5) * 6; // 150 - (dist-5) * 6
                    }
                }
                
                let enemyHeal = 0;
                if (global.State && global.State.enemyProfiles && global.State.enemyProfiles.has(targetHostile.id)) {
                    enemyHeal = global.State.enemyProfiles.get(targetHostile.id).healParts * 12;
                }

                if (enemyHeal > damage) {
                    // Stall the enemy infinitely by repairing/healing instead of wasting energy
                    if (defenseRepairTarget) {
                        tower.repair(defenseRepairTarget);
                    }
                } else {
                    if (dist <= 50) {
                        tower.attack(targetHostile);
                    }
                }
            }
        }
        } catch (e) {
        console.log(`[TowerManager Error] Room ${room.name}: ${e.stack}`);
    }
}

const runTicks = new Map();

function executeRun(room, defenseRepairTarget = null) {
    const key = room.name + (defenseRepairTarget ? '_repair' : '_attack');
    if (runTicks.get(key) === Game.time) return;
    runTicks.set(key, Game.time);

    run(room, defenseRepairTarget);
}

eventBus.subscribe('HOSTILE_SPOTTED', (payload) => {
    const roomName = payload.roomName;
    const room = global.State && global.State.rooms ? global.State.rooms.get(roomName) : (typeof Game !== 'undefined' && Game.rooms ? Game.rooms[roomName] : null);
    if (room) {
        executeRun(room);
    }
});

eventBus.subscribe('DEFENSE_REPAIR_REQUEST', (payload) => {
    if (payload && payload.room) {
        executeRun(payload.room, payload.defenseRepairTarget);
    }
});

module.exports = { run: executeRun };
