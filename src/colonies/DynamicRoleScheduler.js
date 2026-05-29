/**
 * @file DynamicRoleScheduler.js
 * @description Dynamically shifts creep roles based on real-time colony crises or priorities.
 */

class DynamicRoleScheduler {
    /**
     * Evaluates room conditions and shifts creep roles to address critical needs.
     * @param {Room} room - The room object.
     */
    static run(room) {
        if (!room || !global.State || !global.State.creepsByRoom) return;

        const roomCreepsMap = global.State.creepsByRoom.get(room.name);
        if (!roomCreepsMap) return;

        const harvesters = roomCreepsMap.get('harvester') || [];
        const upgraders = roomCreepsMap.get('upgrader') || [];
        const emergencyBuilders = roomCreepsMap.get('emergencyBuilder') || [];
        const workers = roomCreepsMap.get('worker') || [];

        const isDeathSpiral = room.energyAvailable === 0 && harvesters.length === 0;

        // 1. Handle Death Spiral / Energy Crisis
        if (isDeathSpiral) {
            // Shift all available upgraders and workers to emergencyBuilder
            this._shiftRoles(upgraders, 'emergencyBuilder', roomCreepsMap);
            this._shiftRoles(workers, 'emergencyBuilder', roomCreepsMap);
        } else if (emergencyBuilders.length > 0 && harvesters.length > 0) {
            // Crisis resolved, revert emergencyBuilders based on previousRole
            for (let i = emergencyBuilders.length - 1; i >= 0; i--) {
                const creep = emergencyBuilders[i];
                const prevRole = creep.memory.previousRole || 'upgrader';
                this._shiftRole(creep, prevRole, roomCreepsMap);
            }
        }

        // 2. Handle Critical Construction (e.g., Spawn or Tower)
        if (!isDeathSpiral) {
            const sitesMap = global.State.sitesByRoom.get(room.name);
            let hasCriticalSite = false;

            if (sitesMap) {
                const sitesIter = sitesMap instanceof Map ? sitesMap.values() : sitesMap;
                for (const site of sitesIter) {
                    if (site.structureType === STRUCTURE_SPAWN || site.structureType === STRUCTURE_TOWER) {
                        hasCriticalSite = true;
                        break;
                    }
                }
            }

            if (hasCriticalSite) {
                // If we have critical sites, shift some upgraders to workers to speed up construction
                if (upgraders.length > 0) {
                    // Shift at most 1 upgrader to worker per tick if needed
                    const candidate = upgraders[0];
                    this._shiftRole(candidate, 'worker', roomCreepsMap);
                }
            } else {
                // If no critical site exists, revert workers that were originally upgraders
                if (workers.length > 0) {
                    for (let i = workers.length - 1; i >= 0; i--) {
                        const creep = workers[i];
                        if (creep.memory.previousRole === 'upgrader') {
                            this._shiftRole(creep, 'upgrader', roomCreepsMap);
                        }
                    }
                }
            }
        }
    }

    /**
     * Shifts an array of creeps to a new role.
     * @param {Array<Creep>} creeps - The array of creeps to shift.
     * @param {string} newRole - The target role.
     * @param {Map} roomCreepsMap - The room's creep map in global state.
     * @private
     */
    static _shiftRoles(creeps, newRole, roomCreepsMap) {
        if (!creeps || creeps.length === 0) return;

        // Loop backwards because shifting removes the creep from the array
        for (let i = creeps.length - 1; i >= 0; i--) {
            this._shiftRole(creeps[i], newRole, roomCreepsMap);
        }
    }

    /**
     * Shifts a single creep to a new role.
     * @param {Creep} creep - The creep to shift.
     * @param {string} newRole - The target role.
     * @param {Map} roomCreepsMap - The room's creep map in global state.
     * @private
     */
    static _shiftRole(creep, newRole, roomCreepsMap) {
        const oldRole = creep.memory.role;
        if (oldRole === newRole) return;

        // Update memory
        creep.memory.role = newRole;
        creep.memory.previousRole = oldRole;

        // Reset heap state
        if (creep.heap) {
            creep.heap.state = null;
            creep.heap.subState = null;
            creep.heap.targetId = null;
        }

        // Update global state tracking for the current tick
        const oldRoleArray = roomCreepsMap.get(oldRole);
        if (oldRoleArray) {
            const index = oldRoleArray.indexOf(creep);
            if (index !== -1) {
                oldRoleArray.splice(index, 1);
            }
        }

        let newRoleArray = roomCreepsMap.get(newRole);
        if (!newRoleArray) {
            newRoleArray = [];
            roomCreepsMap.set(newRole, newRoleArray);
        }
        newRoleArray.push(creep);
    }
}

module.exports = DynamicRoleScheduler;
