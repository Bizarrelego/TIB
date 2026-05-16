/**
 * @file RampartDefenseManager.js
 * @description Coordinates rampart melee creeps to perform rampart dancing. Tracks creep health,
 * identifies idle backups, and issues simultaneous move intents via TrafficManager to swap
 * positions on choke-points to maximize effective defense HP. Integrates with defcon states.
 */

const { DEFCON, determineDefcon } = require('../constants/defcon');
const TrafficManager = require('../traffic/trafficManager');
const movement = require('../utils/movement');

/**
 * Rampart Defense Manager module.
 */
class RampartDefenseManager {
    /**
     * Executes the rampart defense manager logic for the given room.
     * @param {Room} room - The room object.
     */
    run(room) {
        if (!room) return;

        const defconLevel = determineDefcon(room.name);

        // Only run during active defense states
        if (defconLevel > DEFCON.ALERT) return;

        const roomCreeps = global.State.creepsByRoom.get(room.name);
        if (!roomCreeps) return;

        const rampartMelees = roomCreeps.get('rampartMelee');
        if (!rampartMelees || rampartMelees.length === 0) return;

        const structuresMap = global.State.structuresByRoom.get(room.name);
        if (!structuresMap) return;

        const ramparts = structuresMap.get(STRUCTURE_RAMPART) || [];

        // Identify damaged and backup creeps
        const damagedCreeps = [];
        const backupCreeps = [];

        for (const creep of rampartMelees) {
            // Ensure heap is initialized
            if (!creep.heap) creep.heap = {};

            const isOnRampart = ramparts.some(r => r.pos.x === creep.pos.x && r.pos.y === creep.pos.y);

            if (isOnRampart && creep.hits < creep.hitsMax * 0.3) {
                damagedCreeps.push(creep);
            } else if (!isOnRampart && creep.hits >= creep.hitsMax * 0.8) {
                backupCreeps.push(creep);
            }
        }

        // Process swaps and retreats
        for (const damagedCreep of damagedCreeps) {
            let swapped = false;

            if (backupCreeps.length > 0) {
                // Find nearest backup
                let nearestBackup = null;
                let minDistance = Infinity;

                for (const backup of backupCreeps) {
                    const dist = Math.max(
                        Math.abs(backup.pos.x - damagedCreep.pos.x),
                        Math.abs(backup.pos.y - damagedCreep.pos.y)
                    );

                    if (dist < minDistance) {
                        minDistance = dist;
                        nearestBackup = backup;
                    }
                }

                if (nearestBackup) {
                    if (minDistance <= 1) {
                        // Adjacent, issue a swap
                        TrafficManager.registerSwap(damagedCreep, nearestBackup);

                        // Swap parkPos in heap so they remember their new roles
                        const tempParkPos = damagedCreep.heap.parkPos;
                        damagedCreep.heap.parkPos = nearestBackup.heap.parkPos;
                        nearestBackup.heap.parkPos = tempParkPos;

                        swapped = true;
                    } else {
                        // Not adjacent, move backup towards damaged creep
                        movement.moveTo(nearestBackup, damagedCreep.pos);
                    }
                    // Remove nearestBackup from available backups
                    backupCreeps.splice(backupCreeps.indexOf(nearestBackup), 1);
                }
            }

            if (!swapped) {
                // No backup to swap with or not adjacent, standard retreat
                const spawns = global.State.spawnsByRoom.get(room.name) || [];
                if (spawns.length > 0) {
                    // Set retreating flag and temporarily unset parkPos to allow retreating without bouncing back
                    damagedCreep.heap.retreating = true;
                    delete damagedCreep.heap.parkPos;
                    movement.moveTo(damagedCreep, spawns[0].pos);
                }
            } else {
                damagedCreep.heap.retreating = false;
            }
        }
    }
}

module.exports = new RampartDefenseManager();
