/* global DISMANTLE */
const { determineDefcon, DEFCON } = require('../constants/defcon');
const eventBus = require('../os/eventBus');

function getDistance(pos1, pos2) {
    return Math.max(Math.abs(pos1.x - pos2.x), Math.abs(pos1.y - pos2.y));
}

function run(room, defenseRepairTarget = null) {
    if (Game.cpu.bucket < 500) return; // Cascading CPU Throttling: gating tower operations

    try {
        if (!global.State || !global.State.structuresByRoom) return;

        const structuresMap = global.State.structuresByRoom.get(room.name);
        if (!structuresMap) return;

        const towers = structuresMap.get(STRUCTURE_TOWER) || [];
        if (towers.length === 0) return;

        const defconLevel = determineDefcon(room.name);

        let targetHostile = null;
        let targetHeal = null;
        let repairTarget = null;

        // 1. Hostiles Priority
        const hostiles = global.State.hostilesByRoom ? (global.State.hostilesByRoom.get(room.name) || []) : [];
        if (hostiles.length > 0) {
            // Find highest danger hostile, tie-breaking by closest distance to the first tower
            const referencePos = towers[0].pos;
            let maxDanger = -1;
            let minDistance = Infinity;

            for (let i = 0; i < hostiles.length; i++) {
                const hostile = hostiles[i];
                
                // O(1) Threat Caching Lookup
                let danger = 10; // Default base danger
                if (global.State && global.State.enemyProfiles && global.State.enemyProfiles.has(hostile.id)) {
                    const profile = global.State.enemyProfiles.get(hostile.id);
                    danger = (profile.healParts * 4) + (profile.attackParts * 3);
                    if (danger === 0 && profile.isDangerous) danger = 5; // Floor for unclassified danger
                }
                
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

        // 3. Defense / Roads Priority - Only repair critical structures (roads) below 10% HP (Cascading CPU Throttling: Skip if bucket < 1000)
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
                } else if (repairTarget) {
                    tower.repair(repairTarget);
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
