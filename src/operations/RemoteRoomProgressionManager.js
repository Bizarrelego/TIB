/**
 * @file RemoteRoomProgressionManager.js
 * @description Manages the long-term progression and strategic decisions for remote mining rooms.
 * Determines when to claim, build static infrastructure, or abandon a remote room.
 */

const { scoreRoom } = require('./RemoteRoomScorer');
const SpawnQueueManager = require('../managers/SpawnQueueManager');

const PROGRESSION_STATES = {
    UNCLAIMED: 'UNCLAIMED',
    RESERVED: 'RESERVED',
    INFRASTRUCTURE_BUILD: 'INFRASTRUCTURE_BUILD',
    ESTABLISHED: 'ESTABLISHED',
    ABANDONED: 'ABANDONED'
};

/**
 * Main execution loop for remote room progression.
 * @returns {void}
 */
function run() {
    if (!global.State || !global.State.rooms) return;

    for (const room of global.State.rooms.values()) {
        if (!room.controller || !room.controller.my) continue;

        // Ensure state tracking map exists
        if (!room.memory.remoteRoomProgression) {
            room.memory.remoteRoomProgression = new Map();
        }

        const remoteRooms = getAssignedRemoteRooms(room.name);
        for (const remoteRoomName of remoteRooms) {
            manageProgression(room, remoteRoomName);
        }
    }
}

/**
 * Gets the list of remote rooms assigned to a colony.
 * For simplicity, we extract this from creeps memory or cached routes.
 * @param {string} colonyName
 * @returns {string[]}
 */
function getAssignedRemoteRooms(colonyName) {
    const remoteRooms = new Set();
    const colonyCreeps = global.State.creepsByRoom.get(colonyName);

    if (colonyCreeps) {
        const harvesters = colonyCreeps.get('remoteHarvester') || [];
        for (const creep of harvesters) {
            if (creep.memory.targetRoom && creep.memory.targetRoom !== colonyName) {
                remoteRooms.add(creep.memory.targetRoom);
            }
        }
    }

    return Array.from(remoteRooms);
}

/**
 * Manages the progression state of a specific remote room.
 * @param {Room} colonyRoom
 * @param {string} remoteRoomName
 */
function manageProgression(colonyRoom, remoteRoomName) {
    const stateRecord = colonyRoom.memory.remoteRoomProgression.get(remoteRoomName) || { state: PROGRESSION_STATES.UNCLAIMED };
    const scoreData = scoreRoom(remoteRoomName, colonyRoom.name);

    if (scoreData.isDangerous) {
        // High threat detected, consider abandonment or halting progression
        if (stateRecord.state !== PROGRESSION_STATES.ABANDONED) {
            abandonRoom(colonyRoom, remoteRoomName, stateRecord);
        }
        return; // Pause progression until safe
    }

    // If we recovered from abandonment
    if (stateRecord.state === PROGRESSION_STATES.ABANDONED && !scoreData.isDangerous) {
        stateRecord.state = PROGRESSION_STATES.UNCLAIMED; // Reset to start
    }

    switch (stateRecord.state) {
        case PROGRESSION_STATES.UNCLAIMED:
            if (colonyRoom.controller.level >= 4 && scoreData.energyYield >= 1500) {
                deployReservers(colonyRoom, remoteRoomName);

                // Check if it actually got reserved
                const intel = global.State.intel && global.State.intel.get(remoteRoomName);
                if (intel && intel.reservation === (global.State.username || 'jules')) {
                    stateRecord.state = PROGRESSION_STATES.RESERVED;
                }
            }
            break;

        case PROGRESSION_STATES.RESERVED:
            // Ensure reservations are maintained
            deployReservers(colonyRoom, remoteRoomName);

            // Move to infrastructure if score and RCL allows
            if (colonyRoom.controller.level >= 4) {
                stateRecord.state = PROGRESSION_STATES.INFRASTRUCTURE_BUILD;
            }
            break;

        case PROGRESSION_STATES.INFRASTRUCTURE_BUILD:
            deployReservers(colonyRoom, remoteRoomName);
            buildInfrastructure(colonyRoom, remoteRoomName);

            // Transition to established if infrastructure is complete (simplified check)
            if (isInfrastructureComplete(remoteRoomName)) {
                stateRecord.state = PROGRESSION_STATES.ESTABLISHED;
            }
            break;

        case PROGRESSION_STATES.ESTABLISHED:
            deployReservers(colonyRoom, remoteRoomName);
            // Maintenance logic would go here
            break;

        case PROGRESSION_STATES.ABANDONED:
            // Handled at the top
            break;
    }

    colonyRoom.memory.remoteRoomProgression.set(remoteRoomName, stateRecord);
}

/**
 * Deploys a reserver creep to the remote room.
 * @param {Room} colonyRoom
 * @param {string} remoteRoomName
 */
function deployReservers(colonyRoom, remoteRoomName) {
    let reserverExists = false;
    const colonyCreeps = global.State.creepsByRoom.get(colonyRoom.name);

    if (colonyCreeps) {
        const reservers = colonyCreeps.get('reserver') || [];
        for (const creep of reservers) {
            if (creep.memory.targetRoom === remoteRoomName) {
                reserverExists = true;
                break;
            }
        }
    }

    if (!reserverExists && SpawnQueueManager.getQueuedCount(colonyRoom.name, 'reserver', remoteRoomName) === 0) {
        const body = colonyRoom.energyCapacityAvailable >= 1300 ? [CLAIM, CLAIM, MOVE, MOVE] : [CLAIM, MOVE];
        const cost = colonyRoom.energyCapacityAvailable >= 1300 ? 1300 : 650;

        if (colonyRoom.energyCapacityAvailable >= cost) {
            SpawnQueueManager.requestSpawn(colonyRoom.name, 'reserver', body, 'reserver_' + remoteRoomName + '_' + Game.time, {
                memory: { role: 'reserver', colony: colonyRoom.name, targetRoom: remoteRoomName }
            }, cost);
        }
    }
}

/**
 * Initiates construction of static infrastructure in the remote room.
 * @param {Room} colonyRoom
 * @param {string} remoteRoomName
 */
function buildInfrastructure(colonyRoom, remoteRoomName) {
    if (!global.State.sourcesByRoom || !global.State.sourcesByRoom.has(remoteRoomName)) return;

    const sources = global.State.sourcesByRoom.get(remoteRoomName);
    const sites = global.State.sitesByRoom ? global.State.sitesByRoom.get(remoteRoomName) || [] : [];

    // Throttle construction sites
    if (sites.length >= 3) return;

    // Only build if we have vision (sources object exists implies vision usually, but ensure Game.rooms)
    if (!Game.rooms[remoteRoomName]) return;

    for (const source of sources) {
        // Find if a container already exists nearby
        const structures = global.State.structuresByRoom.get(remoteRoomName);
        let containerExists = false;

        if (structures) {
            const containers = structures.get(STRUCTURE_CONTAINER) || [];
            for (const container of containers) {
                if (container.pos.inRangeTo(source.pos, 2)) {
                    containerExists = true;
                    break;
                }
            }
        }

        if (!containerExists) {
            // Check if site exists
            let siteExists = false;
            for (const site of sites) {
                if (site.structureType === STRUCTURE_CONTAINER && site.pos.inRangeTo(source.pos, 2)) {
                    siteExists = true;
                    break;
                }
            }

            if (!siteExists) {
                // Place container site. (In a real system, use optimal spot finding, here we use a simplistic offset)
                // Assuming +1 x, +1 y is walkable for the sake of the exercise.
                const buildPos = new RoomPosition(source.pos.x + 1, source.pos.y + 1, remoteRoomName);
                if (buildPos.x > 0 && buildPos.x < 49 && buildPos.y > 0 && buildPos.y < 49) {
                    buildPos.createConstructionSite(STRUCTURE_CONTAINER);
                    break; // Only one site at a time
                }
            }
        }
    }
}

/**
 * Checks if infrastructure in the remote room is complete.
 * @param {string} remoteRoomName
 * @returns {boolean}
 */
function isInfrastructureComplete(remoteRoomName) {
    if (!global.State.sourcesByRoom || !global.State.sourcesByRoom.has(remoteRoomName)) return false;

    const sources = global.State.sourcesByRoom.get(remoteRoomName);
    const structures = global.State.structuresByRoom.get(remoteRoomName);

    if (!structures) return false;

    const containers = structures.get(STRUCTURE_CONTAINER) || [];
    let coveredSources = 0;

    for (const source of sources) {
        for (const container of containers) {
            if (container.pos.inRangeTo(source.pos, 2)) {
                coveredSources++;
                break;
            }
        }
    }

    return coveredSources === sources.length;
}

/**
 * Handles logic for abandoning a remote room.
 * @param {Room} colonyRoom
 * @param {string} remoteRoomName
 * @param {Object} stateRecord
 */
function abandonRoom(colonyRoom, remoteRoomName, stateRecord) {
    stateRecord.state = PROGRESSION_STATES.ABANDONED;

    // The RemoteEconomyManager handles pulling out civilians during threats.
    // This function can be expanded to dismantle infrastructure or reassign roles fully if needed.
}

module.exports = {
    run,
    manageProgression,
    deployReservers,
    buildInfrastructure,
    abandonRoom,
    PROGRESSION_STATES
};
