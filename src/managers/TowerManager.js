const { determineDefcon, DEFCON } = require('../constants/defcon');

function getDistance(pos1, pos2) {
    return Math.max(Math.abs(pos1.x - pos2.x), Math.abs(pos1.y - pos2.y));
}

function getDangerScore(creep) {
    let score = 0;
    if (!creep.body) return 10; // Assume base danger if body is not visible

    for (let i = 0; i < creep.body.length; i++) {
        const type = creep.body[i].type;
        if (type === HEAL) score += 4;
        else if (type === RANGED_ATTACK) score += 3;
        else if (type === ATTACK) score += 2;
        else if (type === DISMANTLE) score += 1;
    }
    return score;
}

function run(room) {
    if (Game.cpu.bucket < 500) return; // Cascading CPU Throttling: gating tower operations

    try {
        if (!global.State || !global.State.structuresByRoom) return;

        const structuresMap = global.State.structuresByRoom.get(room.name);
        if (!structuresMap) return;

        const towers = structuresMap.get(STRUCTURE_TOWER) || [];
        if (towers.length === 0) return;

        const defcon = determineDefcon(room.name);

        let targetHostile = null;
        let targetHeal = null;
        let targetRoad = null;

        // 1. Hostiles Priority
        const hostiles = global.State.hostilesByRoom ? (global.State.hostilesByRoom.get(room.name) || []) : [];
        if (hostiles.length > 0) {
            // Find highest danger hostile, tie-breaking by closest distance to the first tower
            const referencePos = towers[0].pos;
            let maxDanger = -1;
            let minDistance = Infinity;

            for (let i = 0; i < hostiles.length; i++) {
                const hostile = hostiles[i];
                const danger = getDangerScore(hostile);
                const dist = getDistance(referencePos, hostile.pos);

                if (danger > maxDanger || (danger === maxDanger && dist < minDistance)) {
                    maxDanger = danger;
                    minDistance = dist;
                    targetHostile = hostile;
                }
            }
        }

        // 2. Heals Priority - Target damaged friendly creeps
        if (!targetHostile) {
            const creepsMap = global.State.creepsByRoom ? global.State.creepsByRoom.get(room.name) : null;
            if (creepsMap) {
                // Find the most injured friendly creep
                let minHpRatio = 1;
                for (const creeps of creepsMap.values()) {
                    for (let i = 0; i < creeps.length; i++) {
                        const creep = creeps[i];
                        if (creep.hits < creep.hitsMax) {
                            const ratio = creep.hits / creep.hitsMax;
                            if (ratio < minHpRatio) {
                                minHpRatio = ratio;
                                targetHeal = creep;
                            }
                        }
                    }
                }
            }
        }

        // 3. Roads Priority - Only repair critical structures (roads) below 10% HP (Cascading CPU Throttling: Skip if bucket < 1000)
        if (!targetHostile && !targetHeal && Game.cpu.bucket >= 1000) {
            const roads = structuresMap.get(STRUCTURE_ROAD) || [];
            for (let i = 0; i < roads.length; i++) {
                const road = roads[i];
                if (road.hits < road.hitsMax * 0.1) { // Strictly below 10% HP
                    targetRoad = road;
                    break;
                }
            }
        }

        // Execute batched intents for all towers
        for (let i = 0; i < towers.length; i++) {
            const tower = towers[i];

            // Only fire if tower has energy (e.g. > 10 to cover TOWER_ENERGY_COST)
            if (tower.store.getUsedCapacity(RESOURCE_ENERGY) >= 10) {
                if (targetHostile) {
                    // Check range to avoid wasted API calls
                    if (getDistance(tower.pos, targetHostile.pos) <= 50) {
                         tower.attack(targetHostile);
                    }
                } else if (targetHeal) {
                    tower.heal(targetHeal);
                } else if (targetRoad) {
                    tower.repair(targetRoad);
                }
            }
        }
    } catch (e) {
        console.log(`[TowerManager Error] Room ${room.name}: ${e.stack}`);
    }
}

module.exports = { run };
