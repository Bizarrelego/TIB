/**
 * Module for assigning repair targets to creeps.
 * @module RepairAssignmentModule
 */

/**
 * Returns a suitable repair target for the given creep.
 * @param {Creep} creep - The creep looking for a repair target.
 * @returns {{ id: string, pos: RoomPosition } | null} The repair target object containing its ID and position, or null if none found.
 */
function getRepairTarget(creep) {
    if (!creep || !creep.room) return null;

    const roomName = creep.room.name;
    let repairTargets = null;

    // Fetch the repair targets populated by RoomStateScanner via RepairTargetUtility
    if (global.State && global.State.rooms && typeof global.State.rooms.get === 'function') {
        const roomState = global.State.rooms.get(roomName);
        if (roomState) {
            repairTargets = roomState.repairTargets;
        }
    }

    if (!repairTargets || repairTargets.length === 0) {
        return null;
    }

    let bestTarget = null;
    let bestScore = -Infinity;

    for (let i = 0; i < repairTargets.length; i++) {
        const target = repairTargets[i];
        if (!target || !target.pos) continue;

        // Base score is based on distance
        const dx = Math.abs(creep.pos.x - target.pos.x);
        const dy = Math.abs(creep.pos.y - target.pos.y);
        const distance = Math.max(dx, dy) || 1; // Avoid division by zero

        let score = 1000 / distance; // Closer targets have higher scores

        // Structure type weighting
        if (target.structureType === STRUCTURE_WALL || target.structureType === STRUCTURE_RAMPART) {
            // Walls/ramparts have lower base priority unless severely damaged
            score -= 200;

            // Prioritize walls/ramparts with extremely low hits
            if (target.hits < 10000) {
                score += 500;
            }
        } else if (target.structureType === STRUCTURE_ROAD) {
            // Roads have a slight penalty so we prioritize more critical infrastructure
            score -= 50;
        } else {
            // Other infrastructure (containers, spawns, extensions, etc.) gets a boost
            score += 100;

            // Critical boost if below 50% health
            if (target.hits < target.hitsMax * 0.5) {
                score += 300;
            }
        }

        if (score > bestScore) {
            bestScore = score;
            bestTarget = target;
        }
    }

    if (bestTarget) {
        return {
            id: bestTarget.id,
            pos: bestTarget.pos
        };
    }

    return null;
}

module.exports = {
    getRepairTarget
};
