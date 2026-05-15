const fs = require('fs');
let code = fs.readFileSync('src/managers/TowerManager.js', 'utf8');

// The file has:
//         // 3. Defense / Roads Priority - Only repair critical structures (roads) below 10% HP (Cascading CPU Throttling: Skip if bucket < 1000)
//         if (!targetHostile && !targetHeal && Game.cpu.bucket >= 1000) {

const search = `        // 3. Defense / Roads Priority - Only repair critical structures (roads) below 10% HP (Cascading CPU Throttling: Skip if bucket < 1000)
        if (!targetHostile && !targetHeal && Game.cpu.bucket >= 1000) {
            if (defenseRepairTarget) {
                repairTarget = defenseRepairTarget;
            } else if (defconLevel > DEFCON.ALERT) {
                // Only repair roads if DEFCON is not high
                const roads = structuresMap.get(STRUCTURE_ROAD) || [];
                for (let i = 0; i < roads.length; i++) {
                    const road = roads[i];
                    if (road.hits < road.hitsMax * 0.1) { // Strictly below 10% HP
                        repairTarget = road;
                        break;
                    }
                }
            }
        }`;

const replace = `        // 3. Defense / Roads Priority - Only repair critical structures (roads) below 10% HP (Cascading CPU Throttling: Skip if bucket < 1000)
        if (!targetHostile && !targetHeal && Game.cpu.bucket >= 1000 && room.energyAvailable >= (room.energyCapacityAvailable * 0.7)) {
            if (defenseRepairTarget) {
                let isValidTarget = true;
                if ((defenseRepairTarget.structureType === STRUCTURE_RAMPART || defenseRepairTarget.structureType === STRUCTURE_WALL) &&
                    defenseRepairTarget.hits >= 25000 &&
                    room.controller && room.controller.level <= 3) {
                    isValidTarget = false;
                }
                if (isValidTarget) {
                    repairTarget = defenseRepairTarget;
                }
            } else if (defconLevel > DEFCON.ALERT) {
                // Only repair roads if DEFCON is not high
                const roads = structuresMap.get(STRUCTURE_ROAD) || [];
                for (let i = 0; i < roads.length; i++) {
                    const road = roads[i];
                    if (road.hits < road.hitsMax * 0.1) { // Strictly below 10% HP
                        repairTarget = road;
                        break;
                    }
                }
            }
        }`;

code = code.replace(search, replace);
fs.writeFileSync('src/managers/TowerManager.js', code);
console.log('TowerManager updated');
