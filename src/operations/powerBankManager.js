const Profiler = require('../utils/profiler');
const { wrapModuleFunctions } = require('../utils/moduleWrapper');
const { executeManager } = require('../utils/errorHandler');
const SpawnQueueManager = require('../managers/SpawnQueueManager');

/**
 * @file powerBankManager.js
 * @description Manages power bank operations.
 */

function getRoomType(roomName) {
    const coords = roomName.match(/[a-zA-Z]+|[0-9]+/g);
    if (!coords) return 'regular';
    const x = parseInt(coords[1], 10);
    const y = parseInt(coords[3], 10);

    if (x % 10 === 0 || y % 10 === 0) return 'highway';
    return 'regular';
}

function runPowerBankOperations() {
    if (!global.State || !global.State.scannedRooms) return;

    for (const roomName of global.State.scannedRooms) {
        const roomType = getRoomType(roomName);
        if (roomType !== 'highway') continue;

        const roomStructures = global.State.structuresByRoom.get(roomName) || new Map();
        const powerBanks = roomStructures.get(STRUCTURE_POWER_BANK);

        if (powerBanks) {
            const banksArray = powerBanks instanceof Map ? Array.from(powerBanks.values()) : powerBanks;
            for (const powerBank of banksArray) {
                if (Game.time % 50 !== 0) continue;

                let closestRoomName = null;
                let minDistance = Infinity;

                if (global.State.rooms) {
                    for (const [baseName, baseRoom] of global.State.rooms.entries()) {
                        if (baseRoom.controller && baseRoom.controller.my && baseRoom.energyCapacityAvailable >= 4000) {
                            const dist = Game.map.getRoomLinearDistance(baseName, roomName);
                            if (dist < minDistance) {
                                minDistance = dist;
                                closestRoomName = baseName;
                            }
                        }
                    }
                }

                if (!closestRoomName) continue;

                const dist = Game.map.getRoomLinearDistance(closestRoomName, roomName);

                // Check assigned attackers/healers
                let assignedAttackersCount = 0;
                let assignedHealersCount = 0;
                let assignedCapacity = 0;

                for (const creepsByRole of global.State.creepsByRoom.values()) {
                    const attackers = creepsByRole.get('powerAttacker') || [];
                    for (const a of attackers) {
                        if (a.memory.targetRoom === roomName && a.memory.targetId === powerBank.id) {
                            assignedAttackersCount++;
                        }
                    }

                    const healers = creepsByRole.get('powerHealer') || [];
                    for (const h of healers) {
                        if (h.memory.targetRoom === roomName && h.memory.targetId === powerBank.id) {
                            assignedHealersCount++;
                        }
                    }

                    const haulers = creepsByRole.get('powerHauler') || [];
                    for (const h of haulers) {
                        if (h.memory.targetRoom === roomName && h.memory.targetId === powerBank.id) {
                            assignedCapacity += h.store.getCapacity();
                        }
                    }
                }

                const ticksToKill = powerBank.hits / 600; // 600 damage per tick assumption
                const travelTime = dist * 50;

                // Spawn attackers/healers if the bank can be killed in time
                if (powerBank.ticksToDecay > travelTime + ticksToKill) {
                    if (assignedAttackersCount < 1) {
                        // Max attack body
                        const attackBody = [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK];
                        const cost = 3200;
                        SpawnQueueManager.requestSpawn(closestRoomName, 'powerAttacker', attackBody, 'pAtk_' + Game.time + '_' + Math.floor(Math.random() * 100), {
                            memory: { role: 'powerAttacker', colony: closestRoomName, targetRoom: roomName, homeRoom: closestRoomName, targetId: powerBank.id }
                        }, cost);
                    }

                    if (assignedHealersCount < 1) {
                        // Max heal body matching the attacker
                        const healBody = [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL];
                        const cost = 6000;
                        SpawnQueueManager.requestSpawn(closestRoomName, 'powerHealer', healBody, 'pHeal_' + Game.time + '_' + Math.floor(Math.random() * 100), {
                            memory: { role: 'powerHealer', colony: closestRoomName, targetRoom: roomName, homeRoom: closestRoomName, targetId: powerBank.id }
                        }, cost);
                    }
                }


                // Dispatch powerHauler precisely when bank HP reaches kill threshold
                if (ticksToKill <= travelTime + 150 && assignedCapacity < powerBank.power) {
                    const BodyCalc = require('../utils/bodyCalc');
                    const body = BodyCalc.calculatePowerHauler(global.State.rooms.get(closestRoomName).energyCapacityAvailable, dist, powerBank.power - assignedCapacity);
                    const cost = BodyCalc.getCost(body);
                    SpawnQueueManager.requestSpawn(closestRoomName, 'powerHauler', body, 'pHaul_' + Game.time + '_' + Math.floor(Math.random() * 100), {
                        memory: { role: 'powerHauler', colony: closestRoomName, targetRoom: roomName, homeRoom: closestRoomName, targetId: powerBank.id }
                    }, cost);
                }
            }
        }
    }
}

const exportedModule = Profiler.wrap('powerBankManager', runPowerBankOperations);

module.exports = wrapModuleFunctions(exportedModule, (funcName, originalFunc, ...args) => executeManager(`powerBankManager.${funcName}`, originalFunc, ...args));
