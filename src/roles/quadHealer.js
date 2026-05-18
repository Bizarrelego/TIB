/**
 * @file quadHealer.js
 * @description Dedicated role module for quadHealer, complementing quadAttacker in Quad Operations.
 * Focuses on maintaining formation and executing predictive pre-healing.
 */

const CombatManager = require('../managers/CombatManager');

module.exports = {
    /**
     * Executes logic for the quadHealer role.
     * Integrates with QuadSquadManager and applies Predictive Pre-Healing to squad members.
     * @param {Room} room - The room in which the creep is executing its logic.
     */
    run(room) {
        if (!global.State || !global.State.creepsByRoom) return;

        const roomCreeps = global.State.creepsByRoom.get(room.name);
        if (!roomCreeps) return;

        const quadHealers = roomCreeps.get('quadHealer');
        if (!quadHealers || quadHealers.length === 0) return;

        if (!global.State.activeQuads) return;

        // Collect enemy towers for predictive healing
        const roomStructures = global.State.structuresByRoom ? global.State.structuresByRoom.get(room.name) || new Map() : new Map();
        const towers = roomStructures.get(STRUCTURE_TOWER) || [];
        const enemyTowers = [];
        for (let i = 0; i < towers.length; i++) {
            if (!towers[i].my) {
                enemyTowers.push(towers[i]);
            }
        }

        const hostiles = global.State.hostilesByRoom ? global.State.hostilesByRoom.get(room.name) || [] : [];

        for (const creep of quadHealers) {
            try {
                if (creep.fatigue > 0) continue;

                let myQuadObj = null;
                for (const [, quadObj] of global.State.activeQuads) {
                    if (quadObj.creeps && quadObj.creeps.includes(creep)) {
                        myQuadObj = quadObj;
                        break;
                    }
                }

                if (!myQuadObj) continue;

                let healTarget = null;
                let highestExpectedDamage = 0;

                // Prioritize healing based on actual damage and predictive incoming damage
                for (const member of myQuadObj.creeps) {
                    // Check for damage and predict incoming tower/hostile damage
                    let expectedDamage = 0;

                    if (enemyTowers) {
                        for (const tower of enemyTowers) {
                            if (member.pos.getRangeTo(tower) <= 15) { // Assuming tower will likely target this creep if close
                                expectedDamage += 600; // Max tower damage at close range
                            }
                        }
                    }

                    if (hostiles) {
                        for (const hostile of hostiles) {
                            let isDangerous = true;
                            if (global.State && global.State.enemyProfiles && global.State.enemyProfiles.has(hostile.id)) {
                                isDangerous = global.State.enemyProfiles.get(hostile.id).isDangerous;
                            }
                            if (isDangerous) {
                                if (member.pos.getRangeTo(hostile) <= 3) {
                                    expectedDamage += 100; // Estimate
                                }
                            }
                        }
                    }

                    // Add current missing health to the weight
                    expectedDamage += (member.hitsMax - member.hits);

                    if (expectedDamage > highestExpectedDamage) {
                        highestExpectedDamage = expectedDamage;
                        healTarget = member;
                    }
                }

                // Execute the heal
                if (healTarget) {
                    if (creep.pos.isNearTo(healTarget)) {
                        creep.heal(healTarget);
                    } else if (creep.pos.inRangeTo(healTarget, 3)) {
                        creep.rangedHeal(healTarget);
                    }
                } else if (creep.hits < creep.hitsMax) {
                    // Fallback to self-heal
                    creep.heal(creep);
                }

                // Determine movement based on leader if this creep isn't the leader
                if (myQuadObj.creeps[0] !== creep) {
                    if (myQuadObj.action === 'move' || myQuadObj.action === 'attack') {
                        // The actual group movement is atomic lockstep inside QuadSquadManager.
                        // We do not issue individual move intents here that might overwrite the group's locked intent pipeline.
                    }
                } else {
                    // If the healer is somehow the leader (e.g. attackers died), determine basic target/movement
                    const target = CombatManager.getBestTarget(creep, hostiles);
                    if (target) {
                        myQuadObj.target = target;
                        myQuadObj.action = 'move'; // We only heal, we move to stay in range but away from danger
                    } else {
                        myQuadObj.target = new RoomPosition(25, 25, room.name);
                        myQuadObj.action = 'move';
                    }
                }

                // Track health for rotation to pull damaged line-members to the back
                if (creep.hits < creep.hitsMax * 0.8) {
                    myQuadObj.needsRotation = true;
                }

            } catch (e) {
                console.log(`[quadHealer Error] Room ${room.name}, Creep ${creep.name}: ${e.stack}`);
            }
        }
    }
};
