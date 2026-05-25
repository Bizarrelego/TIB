const { wrapManager } = require('../utils/ManagerErrorBoundary');
const MiningPlanner = require('./MiningPlanner');
const SpawnQueueManager = require('../managers/SpawnQueueManager');

/**
 * @file RCL3RemoteOps.js
 * @description Manages RCL 3 specific behaviors: Initiating remote mining in 1-2 adjacent rooms.
 */

/**
 * Runs the RCL 3 Remote Ops logic for a given room.
 * @param {Room} room - The room to process.
 */
const { BASE_LAYOUT_STAMP } = require('../constants/baseLayout');

function run(room) {
    if (!room.controller || !room.controller.my || room.controller.level !== 3) return;

    try {
        // Immediate Tower Construction Logic
        if (global.State && global.State.structuresByRoom) {
            const structuresMap = global.State.structuresByRoom.get(room.name);
            const towers = structuresMap ? (structuresMap.get(STRUCTURE_TOWER) || new Map()) : new Map();

            const sitesMap = global.State.sitesByRoom ? global.State.sitesByRoom.get(room.name) : [];
            const sitesArray = sitesMap ? (sitesMap instanceof Map ? Array.from(sitesMap.values()) : sitesMap) : [];
            let towerSiteExists = false;
            for (let i = 0; i < sitesArray.length; i++) {
                if (sitesArray[i].structureType === STRUCTURE_TOWER) {
                    towerSiteExists = true;
                    break;
                }
            }

            if (towers.size === 0 && !towerSiteExists) {
                const spawns = structuresMap ? (structuresMap.get(STRUCTURE_SPAWN) || new Map()) : new Map();
                if (spawns.size > 0) {
                    const spawn = spawns.values().next().value;
                    const offsets = BASE_LAYOUT_STAMP.get(STRUCTURE_TOWER);
                    if (offsets && offsets.length > 0) {
                        const dx = offsets[0][0];
                        const dy = offsets[0][1];
                        room.createConstructionSite(spawn.pos.x + dx, spawn.pos.y + dy, STRUCTURE_TOWER);
                    }
                }
            }
        }

        const myUsername = room.controller.owner.username;
        const exits = Game.map.describeExits(room.name);
        if (!exits) return;

        let remoteRoomsTargeted = 0;

        for (const direction in exits) {
            if (remoteRoomsTargeted >= 2) break;

            const targetRoomName = exits[direction];

            let isNeutral = true;
            if (global.State.intel && global.State.intel.has(targetRoomName)) {
                const intel = global.State.intel.get(targetRoomName);
                if (intel.owner && intel.owner !== myUsername) isNeutral = false;
            } else if (Game.rooms[targetRoomName] && Game.rooms[targetRoomName].controller && Game.rooms[targetRoomName].controller.owner) {
                if (Game.rooms[targetRoomName].controller.owner.username !== myUsername) isNeutral = false;
            }

            if (isNeutral) {
                // Ensure Mining spots are planned
                MiningPlanner.planMiningSpots(targetRoomName, room.name);

                // Queue harvester
                if (SpawnQueueManager.getQueuedCount(room.name, 'harvester', targetRoomName) === 0) {
                    const cost = 550;
                    if (room.energyCapacityAvailable >= cost) {
                        SpawnQueueManager.requestSpawn(
                            room.name,
                            'harvester',
                            [WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE],
                            'harvester_' + targetRoomName + '_' + Game.time,
                            { memory: { role: 'harvester', remoteRoom: targetRoomName, colony: room.name } },
                            cost
                        );
                    }
                }

                // Queue hauler
                if (SpawnQueueManager.getQueuedCount(room.name, 'hauler', targetRoomName) === 0) {
                    const cost = 200;
                    if (room.energyCapacityAvailable >= cost) {
                        SpawnQueueManager.requestSpawn(
                            room.name,
                            'hauler',
                            [CARRY, CARRY, MOVE, MOVE],
                            'hauler_' + targetRoomName + '_' + Game.time,
                            { memory: { role: 'hauler', remoteRoom: targetRoomName, colony: room.name } },
                            cost
                        );
                    }
                }

                remoteRoomsTargeted++;
            }
        }
    } catch (e) {
        console.log(`[RCL3RemoteOps Error] Room ${room.name}: ${e.stack}`);
    }
}

module.exports = {
    run: wrapManager(run, 'RCL3RemoteOps')
};
