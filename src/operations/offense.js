/**
 * @file offense.js
 * @description Manages combat & siege execution.
 */

function runAtomicQuads() {
    // Scaffold: Manage 4-creep lockstep chain-pulling
    // If one halts, all wait
    const quads = global.State?.activeQuads || [];
    for (const quad of quads) {
        let allReady = true;
        for (const creepId of quad.members) {
            const creep = Game.getObjectById(creepId);
            if (!creep || creep.fatigue > 0) {
                allReady = false;
                break;
            }
        }
        if (allReady && quad.targetPos) {
            // Group movement logic
            const leader = Game.getObjectById(quad.members[0]);
            if (leader) {
                // Determine direction
                const dir = leader.pos.getDirectionTo(quad.targetPos);
                for (const creepId of quad.members) {
                    const creep = Game.getObjectById(creepId);
                    if (creep) creep.move(dir);
                }
            }
        }
    }
}

function runSynchronizedBurst() {
    // Scaffold: Attackers hold fire until ready, hitting target on exact same tick
    const targets = global.State?.burstTargets || [];
    for (const burst of targets) {
        if (Game.time === burst.executeTick) {
            for (const creepId of burst.attackers) {
                const creep = Game.getObjectById(creepId);
                const target = Game.getObjectById(burst.targetId);
                if (creep && target) {
                    if (creep.pos.getRangeTo(target) <= 1) {
                        creep.attack(target);
                    } else {
                        creep.rangedAttack(target);
                    }
                }
            }
        }
    }
}

function runTowerDrain() {
    // Scaffold: Predictive pre-heals and border bouncing (I-frames)
    const drainers = global.State?.drainers || [];
    for (const creepId of drainers) {
        const creep = Game.getObjectById(creepId);
        if (!creep) continue;

        // Predict damage
        let expectedDamage = 0;
        const roomStructures = global.State.structuresByRoom.get(creep.room.name);
        let towers = [];
        if (roomStructures) {
            const towerStructs = roomStructures.get(STRUCTURE_TOWER);
            if (towerStructs) {
                if (Array.isArray(towerStructs)) {
                    towers = towerStructs.filter(s => !s.my);
                } else if (towerStructs instanceof Map) {
                    towers = Array.from(towerStructs.values()).filter(s => !s.my);
                }
            }
        }

        // Very rough tower damage estimate
        for (const tower of towers) {
            if (tower.store.getUsedCapacity(RESOURCE_ENERGY) >= TOWER_ENERGY_COST) {
                const range = creep.pos.getRangeTo(tower);
                if (range <= TOWER_OPTIMAL_RANGE) {
                    expectedDamage += TOWER_POWER_ATTACK;
                } else if (range >= TOWER_FALLOFF_RANGE) {
                    expectedDamage += TOWER_POWER_ATTACK * (1 - TOWER_FALLOFF);
                } else {
                    expectedDamage += TOWER_POWER_ATTACK; // Simplified
                }
            }
        }

        // Pre-heal if expected damage is high
        if (expectedDamage > 0 || creep.hits < creep.hitsMax) {
            creep.heal(creep);
        }

        // Border bouncing
        if (creep.hits < creep.hitsMax * 0.5 && (creep.pos.x <= 1 || creep.pos.x >= 48 || creep.pos.y <= 1 || creep.pos.y >= 48)) {
            // Move off room edge to other room
            if (creep.pos.x === 1) creep.move(LEFT);
            else if (creep.pos.x === 48) creep.move(RIGHT);
            else if (creep.pos.y === 1) creep.move(TOP);
            else if (creep.pos.y === 48) creep.move(BOTTOM);
        }
    }
}

module.exports = function offenseManager() {
    try {
        // Execute heavy combat logic
        runAtomicQuads();
        runSynchronizedBurst();
        runTowerDrain();
    } catch (e) {
        console.error(`[OffenseManager Error] ${e.stack}`);
    }
};
