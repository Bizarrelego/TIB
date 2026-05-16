/**
 * @file coreSniper.js
 * @description Core Sniping: Block or kill upgraders in low RCL rooms to trigger controller downgrading and wipe neighbors. This role is crucial for asymmetric warfare.
 */

const movement = require('../utils/movement');
const CombatManager = require('../managers/CombatManager');

module.exports = {
    /**
     * Executes logic for coreSniper role.
     * @param {Room} room
     */
    run(room) {
        if (!global.State || !global.State.creepsByRoom) return;

        const roomCreeps = global.State.creepsByRoom.get(room.name);
        if (!roomCreeps) return;

        const coreSnipers = roomCreeps.get('coreSniper');
        if (!coreSnipers || coreSnipers.length === 0) return;

        for (const creep of coreSnipers) {
            try {
                if (creep.fatigue > 0) continue; // Fatigue gating

                // Basic self-preservation logic: retreat if heavily damaged
                if (creep.hits < creep.hitsMax * 0.5) {
                    const homeRoom = creep.memory.homeRoom;
                    if (homeRoom) {
                        CombatManager.borderBounce(creep, homeRoom);
                        continue;
                    }
                }

                const targetRoomName = creep.memory.targetRoom;
                if (!targetRoomName) continue;

                // Move to target room
                if (creep.room.name !== targetRoomName) {
                    const targetPos = new RoomPosition(25, 25, targetRoomName);
                    movement.moveTo(creep, targetPos);
                    continue;
                }

                // In target room, prioritize attacking enemy upgraders or the controller itself
                const targetController = room.controller;
                if (!targetController) {
                    // If no controller found, nothing to snipe
                    continue;
                }

                // Don't attack our own controller
                if (targetController.my) {
                    continue;
                }

                let target = null;
                const hostiles = global.State.hostilesByRoom ? global.State.hostilesByRoom.get(room.name) || [] : [];

                // Find hostiles near the controller (upgraders)
                for (const hostile of hostiles) {
                    if (hostile.pos.getRangeTo(targetController) <= 3) {
                        // Check if it's likely an upgrader (has WORK or CARRY parts)
                        let isUpgrader = false;
                        if (hostile.body) {
                            isUpgrader = hostile.body.some(p => p.type === WORK || p.type === CARRY);
                        } else {
                            // If no body info is available, assume it's an upgrader if near controller
                            isUpgrader = true;
                        }

                        if (isUpgrader) {
                            target = hostile;
                            break;
                        }
                    }
                }

                if (target) {
                    if (creep.pos.isNearTo(target)) {
                        creep.attack(target);
                        // Move with target if it flees
                        movement.moveTo(creep, target);
                    } else {
                        movement.moveTo(creep, target);
                    }
                } else {
                    // No upgraders found, attack controller to block upgrades/trigger downgrade
                    if (creep.pos.isNearTo(targetController)) {
                        creep.attackController(targetController);
                    } else {
                        movement.moveTo(creep, targetController);
                    }
                }
            } catch (e) {
                console.log(`[coreSniper Error] Room ${room.name}, Creep ${creep.name}: ${e.stack}`);
            }
        }
    }
};
