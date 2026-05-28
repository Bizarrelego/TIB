/**
 * @file RemoteRoomScorer.js
 * @description Evaluates and scores potential remote mining or expansion rooms.
 */

/**
 * @typedef {Object} RoomScoreBreakdown
 * @property {number} sourceScore - Score derived from number and density of sources.
 * @property {number} distanceScore - Penalty based on distance from the nearest colony.
 * @property {number} pathingScore - Penalty based on pathing complexity (swamps, obstacles).
 * @property {number} threatScore - Penalty based on presence and strength of hostile creeps/towers/SKs.
 * @property {number} controllerScore - Score adjustment based on controller state.
 */

/**
 * @typedef {Object} RoomScoreResult
 * @property {number} totalScore - The overall calculated score.
 * @property {RoomScoreBreakdown} breakdown - Detailed scoring breakdown.
 * @property {number} energyYield - The estimated energy yield of the room based on sources.
 * @property {boolean} isDangerous - Indicates if the room is deemed dangerous due to threats.
 */

/**
 * Calculates the linear distance between two rooms.
 * @param {string} room1
 * @param {string} room2
 * @returns {number}
 */
function getRoomDistance(room1, room2) {
    const c1 = room1.match(/([WE])([0-9]+)([NS])([0-9]+)/);
    const c2 = room2.match(/([WE])([0-9]+)([NS])([0-9]+)/);

    if (!c1 || !c2) return Infinity;

    const x1 = c1[1] === 'W' ? -parseInt(c1[2], 10) : parseInt(c1[2], 10) + 1;
    const y1 = c1[3] === 'N' ? -parseInt(c1[4], 10) : parseInt(c1[4], 10) + 1;
    const x2 = c2[1] === 'W' ? -parseInt(c2[2], 10) : parseInt(c2[2], 10) + 1;
    const y2 = c2[3] === 'N' ? -parseInt(c2[4], 10) : parseInt(c2[4], 10) + 1;

    return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2));
}

/**
 * Evaluates and scores a room for remote mining or expansion.
 * Relies on global.State.intel to perform zero-CPU-polling analysis.
 *
 * @param {string} roomName - The name of the room to evaluate.
 * @param {string} [colonyRoomName] - Optional nearest colony room name for distance calculation.
 * @returns {RoomScoreResult} The calculated score and breakdown.
 */
function scoreRoom(roomName, colonyRoomName = null) {
    const result = {
        totalScore: 0,
        breakdown: {
            sourceScore: 0,
            distanceScore: 0,
            pathingScore: 0,
            threatScore: 0,
            controllerScore: 0
        }
    };

    if (!global.State || !global.State.intel || !global.State.intel.has(roomName)) {
        return result; // No intel available
    }

    const intel = global.State.intel.get(roomName);

    // 1. Source Score
    const sources = intel.sources || 0;
    result.breakdown.sourceScore += sources * 50;

    // Mineral presence bonus for expansion
    if (intel.mineral) {
        result.breakdown.sourceScore += 25;
    }

    // 2. Controller Score
    if (intel.owner) {
        result.breakdown.controllerScore -= 100; // Owned by someone else
    } else if (intel.reservation && intel.hostile) {
        result.breakdown.controllerScore -= 50; // Reserved by enemy
    }

    // 3. Distance Score
    if (colonyRoomName) {
        const distance = getRoomDistance(roomName, colonyRoomName);
        if (distance !== Infinity) {
            result.breakdown.distanceScore -= distance * 10;
        }
    }

    // 4. Pathing Complexity (Rough estimation based on intel types)
    if (intel.type === 'highway') {
        result.breakdown.pathingScore -= 20; // Highways don't have sources, bad target
    } else if (intel.type === 'center') {
        result.breakdown.pathingScore -= 10; // Center rooms have no sources and are usually dangerous
    }

    // 5. Threat Score (Hostiles, Towers, Source Keepers)
    let threatPenalty = 0;
    if (intel.towerCount > 0) {
        threatPenalty += intel.towerCount * 50;
    }

    if (intel.hostile) {
        threatPenalty += 30;
    }

    if (intel.type === 'sk') {
        threatPenalty += 100; // High threat due to Source Keepers
        if (intel.skLairs) {
            threatPenalty += intel.skLairs * 20;
        }
    }

    // Checking for active enemy remotes
    if (intel.enemyRemoteMiners) {
        threatPenalty += 20; // Minor threat, but implies contention
    }

    result.breakdown.threatScore -= threatPenalty;

    // Calculate Total Score
    result.totalScore =
        result.breakdown.sourceScore +
        result.breakdown.distanceScore +
        result.breakdown.pathingScore +
        result.breakdown.threatScore +
        result.breakdown.controllerScore;

    result.energyYield = sources * 1500; // Base 1500 per source, can be 3000 if reserved
    if (intel.reservation && intel.reservation === (global.State.username || 'jules')) {
        result.energyYield = sources * 3000;
    }

    result.isDangerous = threatPenalty > 50;

    return result;
}

module.exports = { scoreRoom };
