const fs = require('fs');

// Patch TowerManager.js
let towerManager = fs.readFileSync('src/managers/TowerManager.js', 'utf8');
towerManager = towerManager.replace(/function run\(room, defenseRepairTarget = null\) \{[\s\S]*?\} catch \(e\) \{/,
`function run(room, defenseRepairTarget = null) {
    if (Game.cpu.bucket < 500) return;

    try {
        if (!global.State || !global.State.structuresByRoom) return;
        const structuresMap = global.State.structuresByRoom.get(room.name);
        if (!structuresMap) return;

        const towers = structuresMap.get(STRUCTURE_TOWER) || [];
        if (towers.length === 0) return;

        let targetHostile = null;
        const hostiles = global.State.hostilesByRoom ? (global.State.hostilesByRoom.get(room.name) || []) : [];
        if (hostiles.length > 0) {
            const referencePos = towers[0].pos;
            let maxDanger = -1;
            let minDistance = Infinity;

            for (let i = 0; i < hostiles.length; i++) {
                const hostile = hostiles[i];
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
                if (getDistance(tower.pos, targetHostile.pos) <= 50) {
                    tower.attack(targetHostile);
                }
            }
        }`);
fs.writeFileSync('src/managers/TowerManager.js', towerManager);

// Patch logisticsManager.js
let logisticsManager = fs.readFileSync('src/colonies/logisticsManager.js', 'utf8');
logisticsManager = logisticsManager.replace(/const isBootstrapping = true;/, 'const isBootstrapping = false;'); // Avoid overriding things blindly

fs.writeFileSync('src/colonies/logisticsManager.js', logisticsManager);
