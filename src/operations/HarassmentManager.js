const Profiler = require('../utils/profiler');
const { wrapModuleFunctions } = require('../utils/moduleWrapper');
const { executeManager } = require('../utils/errorHandler');
const SpawnQueueManager = require('../managers/SpawnQueueManager');

/**
 * @file HarassmentManager.js
 * @description Manages Early Poaching and Aggression tactics against weak neighbors and remote miners.
 * Identifies targets, deploys simple attack creeps, and coordinates looting of dropped energy.
 */

const exportedModule = Profiler.wrap('HarassmentManager', function HarassmentManager() {
    if (!global.State || !global.State.rooms) return;

    for (const room of global.State.rooms.values()) {
        if (!room.controller || !room.controller.my || room.controller.level < 3) continue;

        const roomCreeps = global.State.creepsByRoom.get(room.name);
        if (!roomCreeps) continue;

        const myUsername = room.controller.owner.username;

        const exits = Game.map.describeExits(room.name);
        if (!exits) continue;

        for (const direction in exits) {
            const targetRoomName = exits[direction];

            let isNeutral = true;
            if (global.State.intel && global.State.intel.has(targetRoomName)) {
                const intel = global.State.intel.get(targetRoomName);
                if (intel.owner && intel.owner !== myUsername) isNeutral = false;
                if (intel.reservation && intel.reservation !== myUsername) isNeutral = false;
            } else if (Game.rooms[targetRoomName] && Game.rooms[targetRoomName].controller && Game.rooms[targetRoomName].controller.owner) {
                if (Game.rooms[targetRoomName].controller.owner.username !== myUsername) isNeutral = false;
            }
            if (!isNeutral) continue;

            // Check if room has a tower
            let hasTower = false;
            if (Game.rooms[targetRoomName]) {
                const structures = global.State.structuresByRoom.get(targetRoomName);
                const towers = structures ? structures.get(STRUCTURE_TOWER) || [] : [];
                if (towers.length > 0) hasTower = true;
            } else if (global.State.intel && global.State.intel.has(targetRoomName)) {
                const intel = global.State.intel.get(targetRoomName);
                if (intel.towers > 0) hasTower = true;
            }

            if (hasTower) continue;

            const hostiles = global.State.hostilesByRoom.get(targetRoomName) || new Map();
            let enemyHarvester = null;
            let enemyDefender = null;

            for (const hostile of hostiles.values()) {
                let isDangerous = false;
                let isHarvester = false;

                if (global.State.enemyProfiles && global.State.enemyProfiles.has(hostile.id)) {
                    isDangerous = global.State.enemyProfiles.get(hostile.id).isDangerous;
                }

                if (hostile.body) {
                    for (let i = 0; i < hostile.body.length; i++) {
                        if (hostile.body[i].type === WORK) isHarvester = true;
                        if (hostile.body[i].type === ATTACK || hostile.body[i].type === RANGED_ATTACK || hostile.body[i].type === HEAL) isDangerous = true;
                    }
                } else {
                    isDangerous = true; // Assume dangerous if body is not visible
                }

                if (isDangerous) enemyDefender = hostile;
                if (isHarvester && !isDangerous) enemyHarvester = hostile;
            }

            // Target found: Unarmored harvester and no defender
            if (enemyHarvester && !enemyDefender) {
                let defenderExists = false;
                const remoteDefenders = roomCreeps.get('harassment') || [];
                for (const d of remoteDefenders) {
                    if (d.memory.targetRoom === targetRoomName) {
                        defenderExists = true;
                        break;
                    }
                }

                if (!defenderExists && SpawnQueueManager.getQueuedCount(room.name, 'harassment', targetRoomName) === 0) {
                    const cost = BODYPART_COST[ATTACK] + BODYPART_COST[MOVE];
                    if (room.energyCapacityAvailable >= cost) {
                        SpawnQueueManager.requestSpawn(room.name, 'harassment', [ATTACK, MOVE], 'harassment_' + Game.time, {
                            memory: { role: 'harassment', colony: room.name, targetRoom: targetRoomName }
                        }, cost);
                    }
                }
            }

            // Check for loot (dropped energy or tombstones)
            let hasLoot = false;
            let lootAmount = 0;

            const tombstones = global.State.tombstonesByRoom.get(targetRoomName);
            if (tombstones) {
                for (const t of tombstones.values()) {
                    if (t.store && t.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                        hasLoot = true;
                        lootAmount += t.store.getUsedCapacity(RESOURCE_ENERGY);
                    }
                }
            }

            const dropped = global.State.droppedByRoom.get(targetRoomName);
            if (dropped) {
                for (const d of dropped.values()) {
                    if (d.resourceType === RESOURCE_ENERGY && d.amount > 0) {
                        hasLoot = true;
                        lootAmount += d.amount;
                    }
                }
            }

            // If there's loot, send or reroute a hauler
            if (hasLoot && lootAmount >= 100 && !enemyDefender) {
                // Reroute existing idle remote hauler
                let rerouted = false;
                const haulers = roomCreeps.get('hauler') || [];
                for (const hauler of haulers) {
                    if (!hauler.memory.hauling && hauler.memory.remoteRoom !== targetRoomName) {
                        hauler.memory.remoteRoom = targetRoomName;
                        rerouted = true;
                        break;
                    }
                }

                // Or spawn a new remote hauler specifically for looting
                if (!rerouted) {
                    let looterExists = false;
                    for (const hauler of haulers) {
                        if (hauler.memory.remoteRoom === targetRoomName) {
                            looterExists = true;
                            break;
                        }
                    }

                    if (!looterExists && SpawnQueueManager.getQueuedCount(room.name, 'hauler', targetRoomName) === 0) {
                        const cost = BODYPART_COST[CARRY] + BODYPART_COST[MOVE];
                        if (room.energyCapacityAvailable >= cost) {
                            SpawnQueueManager.requestSpawn(room.name, 'hauler', [CARRY, MOVE], 'looter_' + Game.time, {
                                memory: { role: 'hauler', colony: room.name, remoteRoom: targetRoomName }
                            }, cost);
                        }
                    }
                }
            }
        }
    }
});

module.exports = wrapModuleFunctions(exportedModule, (funcName, originalFunc, ...args) => executeManager(`HarassmentManager.${funcName}`, originalFunc, ...args));
