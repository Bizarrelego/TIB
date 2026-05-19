const Profiler = require('../utils/profiler');
const SpawnQueueManager = require('../managers/SpawnQueueManager');
const PowerBankDamageCalculator = require('../utils/PowerBankDamageCalculator');
const BodyCalc = require('../utils/bodyCalc');

/**
 * @file powerOperations.js
 * @description Manages highway operations, specifically power bank cracking and harvesting.
 */

/**
 * Extracts coordinates from a room name to determine if it is an SK/highway room.
 * @param {string} roomName
 * @returns {string}
 */
function getRoomType(roomName) {
    const coords = roomName.match(/[a-zA-Z]+|[0-9]+/g);
    if (!coords) return 'regular';
    const x = parseInt(coords[1], 10);
    const y = parseInt(coords[3], 10);

    if (x % 10 === 0 || y % 10 === 0) return 'highway';
    if (x % 10 >= 4 && x % 10 <= 6 && y % 10 >= 4 && y % 10 <= 6) return 'sk';
    if (x % 10 === 5 && y % 10 === 5) return 'center';
    return 'regular';
}

function runPowerOperations() {
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
                        if (baseRoom.controller && baseRoom.controller.my && baseRoom.energyCapacityAvailable >= 7500) {
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

                let attackersCount = 0;
                let healersCount = 0;
                let assignedCapacity = 0;

                for (const creepsByRole of global.State.creepsByRoom.values()) {
                    const attackers = creepsByRole.get('powerAttacker') || [];
                    for (const a of attackers) {
                        if (a.heap.targetRoom === roomName && a.heap.targetId === powerBank.id) attackersCount++;
                    }

                    const healers = creepsByRole.get('powerHealer') || [];
                    for (const h of healers) {
                        if (h.heap.targetRoom === roomName && h.heap.targetId === powerBank.id) healersCount++;
                    }

                    const haulers = creepsByRole.get('powerHauler') || [];
                    for (const h of haulers) {
                        if (h.heap.targetRoom === roomName && h.heap.targetId === powerBank.id) {
                            assignedCapacity += h.store.getCapacity();
                        }
                    }
                }

                const baseRoomObj = global.State.rooms.get(closestRoomName);

                // Calculate needed ticks and DPT
                const ticksAvailable = Math.min(powerBank.ticksToDecay, 1500) - (dist * 50);
                if (ticksAvailable > 0) {
                     const requiredDpt = Math.ceil(powerBank.hits / ticksAvailable);

                     // 1 MAX pair (20 ATTACK) = 600 DPT
                     const maxPairsNeeded = Math.ceil(requiredDpt / 600);

                     if (attackersCount < maxPairsNeeded && healersCount < maxPairsNeeded) {
                         const siegeCalc = PowerBankDamageCalculator.calculateSiege(
                             powerBank.hits,
                             powerBank.ticksToDecay,
                             dist,
                             baseRoomObj.energyCapacityAvailable
                         );

                         if (siegeCalc) {
                             const time = Game.time;
                             const r = Math.floor(Math.random() * 100);

                             SpawnQueueManager.requestSpawn(closestRoomName, 'powerHealer', siegeCalc.healerBody, 'pHeal_' + time + '_' + r, {
                                memory: { role: 'powerHealer', colony: closestRoomName }, heap: { targetRoom: roomName, homeRoom: closestRoomName, targetId: powerBank.id }
                             }, siegeCalc.healerCost);

                             SpawnQueueManager.requestSpawn(closestRoomName, 'powerAttacker', siegeCalc.attackerBody, 'pAtk_' + time + '_' + r, {
                                memory: { role: 'powerAttacker', colony: closestRoomName }, heap: { targetRoom: roomName, homeRoom: closestRoomName, targetId: powerBank.id }
                             }, siegeCalc.attackerCost);
                         }
                     }
                }

                // Hauler dispatch logic
                // Max pair deals 600 DPT
                const estimatedDpt = Math.max(attackersCount * 600, 1);
                const ticksToKill = powerBank.hits / estimatedDpt;
                const travelTime = dist * 50;

                if (ticksToKill <= travelTime + 150 && assignedCapacity < powerBank.power) {
                    const body = BodyCalc.calculatePowerHauler(baseRoomObj.energyCapacityAvailable, dist, powerBank.power - assignedCapacity);
                    const cost = BodyCalc.getCost(body);
                    SpawnQueueManager.requestSpawn(closestRoomName, 'powerHauler', body, 'pHaul_' + Game.time + '_' + Math.floor(Math.random() * 100), {
                        memory: { role: 'powerHauler', colony: closestRoomName }, heap: { targetRoom: roomName, homeRoom: closestRoomName, targetId: powerBank.id }
                    }, cost);
                }
            }
        }
    }
}

module.exports = Profiler.wrap('powerOperations', runPowerOperations);
