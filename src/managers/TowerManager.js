const eventBus = require('../os/eventBus');

function getDistance(pos1, pos2) {
    return Math.max(Math.abs(pos1.x - pos2.x), Math.abs(pos1.y - pos2.y));
}

function run(room, defenseRepairTarget) {
    if (Game.cpu.bucket < 500) return;

    try {
        if (!global.State || !global.State.structuresByRoom) return;
        const structuresMap = global.State.structuresByRoom.get(room.name);
        if (!structuresMap) return;

        const towers = Array.from(structuresMap.get(STRUCTURE_TOWER) || []).map(t => (Array.isArray(t) ? t[1] : t));
        if (towers.length === 0) return;

        let primaryTarget = null;
        let action = null;

        const hostilesMap = global.State.hostilesByRoom ? global.State.hostilesByRoom.get(room.name) : null;
        if (hostilesMap && hostilesMap.size > 0) {
            const referencePos = towers[0].pos;
            let maxDanger = -1;
            let minDistance = Infinity;

            for (const hostile of hostilesMap.values()) {
                let danger = 0;
                let healParts = 0;
                let attackParts = 0;
                
                if (global.State && global.State.enemyProfiles && global.State.enemyProfiles.has(hostile.id)) {
                    const profile = global.State.enemyProfiles.get(hostile.id);
                    healParts = profile.healParts || 0;
                    attackParts = profile.attackParts || 0;
                }

                // Strict targeting array: Hostile Attackers > Hostile Healers. Ignore others.
                if (attackParts > 0) danger = 100;
                else if (healParts > 0) danger = 50;

                if (danger > 0) {
                    const dist = getDistance(referencePos, hostile.pos);

                    if (danger > maxDanger || (danger === maxDanger && dist < minDistance)) {
                        maxDanger = danger;
                        minDistance = dist;
                        primaryTarget = hostile.id;
                        action = 'attack';
                    }
                }
            }
        }

        if (!primaryTarget && defenseRepairTarget) {
            primaryTarget = defenseRepairTarget.id;
            action = 'repair';
        }

        // Write intents top-down
        if (!global.State.towerIntents) global.State.towerIntents = new Map();

        for (const tower of towers) {
            if (primaryTarget) {
                global.State.towerIntents.set(tower.id, { action: action, targetId: primaryTarget });
            } else {
                global.State.towerIntents.delete(tower.id);
            }
        }
    } catch (e) {
        console.log(`[TowerManager Error] Room ${room.name}: ${e.stack}`);
    }
}

const runTicks = new Map();

function executeRun(room, defenseRepairTarget) {
    const key = room.name + '_attack';
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

module.exports = { run: executeRun };
