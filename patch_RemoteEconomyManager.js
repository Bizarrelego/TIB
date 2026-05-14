const fs = require('fs');
let code = fs.readFileSync('src/managers/RemoteEconomyManager.js', 'utf8');

const replacement = `const SpawnQueueManager = require('./SpawnQueueManager');
const BodyCalc = require('../utils/bodyCalc');

module.exports = {
    /**
     * Evaluates room state and assigns target sources and containers directly to creep memory/heap.
     * @param {Room} room
     */
    run(room) {
        let colonyRemoteHarvesters = [];
        let colonyRemoteHaulers = [];
        let colonyReservers = [];

        // Gather all creeps globally that belong to this colony
        for (const roomCreeps of global.State.creepsByRoom.values()) {
            const rHarvesters = roomCreeps.get('remoteHarvester');
            if (rHarvesters) {
                for (let i = 0; i < rHarvesters.length; i++) {
                    if (rHarvesters[i].memory.colony === room.name) colonyRemoteHarvesters.push(rHarvesters[i]);
                }
            }

            const rHaulers = roomCreeps.get('remoteHauler');
            if (rHaulers) {
                for (let i = 0; i < rHaulers.length; i++) {
                    if (rHaulers[i].memory.colony === room.name) colonyRemoteHaulers.push(rHaulers[i]);
                }
            }

            const reservers = roomCreeps.get('reserver');
            if (reservers) {
                for (let i = 0; i < reservers.length; i++) {
                    if (reservers[i].memory.colony === room.name) colonyReservers.push(reservers[i]);
                }
            }
        }

        // Evaluate global intel to determine required roles for remote economy
        if (global.State && global.State.intel && room.memory.remoteRooms) {
            const capacity = room.energyCapacityAvailable || 300;

            for (const remoteRoomName of room.memory.remoteRooms) {
                const intel = global.State.intel.get(remoteRoomName);
                if (!intel || intel.hostile) continue;

                // Desired Creeps per room
                const sourcesCount = intel.sources || 0;
                const distance = 50; // Approximated distance if not precalculated
                const needReserver = !intel.owner && !intel.reservation;
                const needHarvesters = sourcesCount;
                const needHaulers = sourcesCount;

                // Spawning Logic
                let currentHarvesters = colonyRemoteHarvesters.filter(c => c.memory.targetRoom === remoteRoomName).length;
                let currentHaulers = colonyRemoteHaulers.filter(c => c.memory.remoteRoom === remoteRoomName).length;
                let currentReservers = colonyReservers.filter(c => c.memory.targetRoom === remoteRoomName).length;

                // Spawn Harvesters
                if (currentHarvesters < needHarvesters) {
                    const body = BodyCalc.calculateRemoteMiner(capacity);
                    const cost = BodyCalc.getCost(body);
                    const name = 'remoteHarvester_' + Game.time + '_' + Math.floor(Math.random() * 100);
                    SpawnQueueManager.requestSpawn(room.name, 'remoteHarvester', body, name, {
                        memory: { role: 'remoteHarvester', colony: room.name, targetRoom: remoteRoomName, homeRoom: room.name }
                    }, cost);
                }

                // Spawn Haulers
                if (currentHaulers < needHaulers) {
                    const body = BodyCalc.calculateHauler(capacity, distance, 10);
                    const cost = BodyCalc.getCost(body);
                    const name = 'remoteHauler_' + Game.time + '_' + Math.floor(Math.random() * 100);
                    SpawnQueueManager.requestSpawn(room.name, 'remoteHauler', body, name, {
                        memory: { role: 'remoteHauler', colony: room.name, remoteRoom: remoteRoomName, homeRoom: room.name }
                    }, cost);
                }

                // Spawn Reserver
                if (needReserver && currentReservers < 1) {
                    // Statically defined reserver body based on available energy capacity
                    let body = [CLAIM, MOVE];
                    let cost = BODYPART_COST[CLAIM] + BODYPART_COST[MOVE];
                    if (capacity >= cost * 2) {
                        body = [CLAIM, CLAIM, MOVE, MOVE];
                        cost = cost * 2;
                    }
                    const name = 'reserver_' + Game.time + '_' + Math.floor(Math.random() * 100);
                    SpawnQueueManager.requestSpawn(room.name, 'reserver', body, name, {
                        memory: { role: 'reserver', colony: room.name, targetRoom: remoteRoomName }
                    }, cost);
                }

                // Remote Container Construction
                const remoteRoom = Game.rooms[remoteRoomName];
                if (remoteRoom) {
                    const sources = global.State.sourcesByRoom.get(remoteRoomName) || [];
                    const sites = global.State.sitesByRoom.get(remoteRoomName) || [];
                    const structures = global.State.structuresByRoom.get(remoteRoomName);
                    const containers = structures ? (structures.get(STRUCTURE_CONTAINER) || []) : [];

                    for (const source of sources) {
                        // Check if a container exists near this source
                        let hasContainer = false;
                        for (let i = 0; i < containers.length; i++) {
                            if (source.pos.isNearTo(containers[i])) {
                                hasContainer = true;
                                break;
                            }
                        }

                        if (!hasContainer) {
                            // Check if a site exists
                            let hasSite = false;
                            for (let i = 0; i < sites.length; i++) {
                                if (sites[i].structureType === STRUCTURE_CONTAINER && source.pos.inRangeTo(sites[i], 2)) {
                                    hasSite = true;
                                    break;
                                }
                            }

                            if (!hasSite) {
                                // Find optimal position for container (1 tile away from source)
                                const terrain = new Room.Terrain(remoteRoomName);
                                let bestPos = null;
                                for (let dx = -1; dx <= 1; dx++) {
                                    for (let dy = -1; dy <= 1; dy++) {
                                        if (dx === 0 && dy === 0) continue;
                                        const x = source.pos.x + dx;
                                        const y = source.pos.y + dy;
                                        if (x < 1 || x > 48 || y < 1 || y > 48) continue;
                                        if (terrain.get(x, y) !== TERRAIN_MASK_WALL) {
                                            bestPos = new RoomPosition(x, y, remoteRoomName);
                                            break;
                                        }
                                    }
                                    if (bestPos) break;
                                }

                                if (bestPos) {
                                    remoteRoom.createConstructionSite(bestPos, STRUCTURE_CONTAINER);
                                }
                            }
                        }
                    }
                }
            }
        }`;

code = code.replace(/module\.exports = \{[\s\S]*?run\(room\) \{[\s\S]*\n\s*\}\n\};/g, replacement + `

        if (colonyRemoteHarvesters.length > 0) {
            for (const creep of colonyRemoteHarvesters) {
                // Ensure homeRoom and targetRoom are consistent
                if (!creep.memory.homeRoom) creep.memory.homeRoom = room.name;

                if (!creep.memory.targetSourceId && creep.room.name === creep.memory.targetRoom) {
                    const roomSources = global.State.sourcesByRoom.get(creep.room.name) || [];
                    const assignedSources = colonyRemoteHarvesters.map(c => c.memory.targetSourceId).filter(id => id);

                    for (const src of roomSources) {
                        if (!assignedSources.includes(src.id)) {
                            creep.memory.targetSourceId = src.id;
                            break;
                        }
                    }
                }

                // Container lifecycle awareness for harvesters
                if (creep.memory.containerId && Game.rooms[creep.memory.targetRoom]) {
                    // Room is visible, check if container exists
                    const container = Game.getObjectById(creep.memory.containerId);
                    if (!container) {
                        creep.memory.containerId = null; // Container destroyed or invalid
                    }
                }

                if (!creep.memory.containerId && creep.room.name === creep.memory.targetRoom && creep.memory.targetSourceId) {
                    const source = Game.getObjectById(creep.memory.targetSourceId);
                    if (source) {
                        const structuresMap = global.State.structuresByRoom.get(creep.room.name);
                        if (structuresMap) {
                            const containers = structuresMap.get(STRUCTURE_CONTAINER) || [];
                            for (let i = 0; i < containers.length; i++) {
                                if (containers[i].pos.isNearTo(source)) {
                                    creep.memory.containerId = containers[i].id;
                                    break;
                                }
                            }
                        }
                    }
                }
            }
        }

        if (colonyRemoteHaulers.length > 0) {
            for (const creep of colonyRemoteHaulers) {
                // Ensure homeRoom and remoteRoom are consistent
                if (!creep.memory.homeRoom) creep.memory.homeRoom = room.name;

                // Container lifecycle awareness for haulers
                if (creep.memory.containerId && Game.rooms[creep.memory.remoteRoom]) {
                    // Room is visible, check if container exists
                    const container = Game.getObjectById(creep.memory.containerId);
                    if (!container) {
                        creep.memory.containerId = null; // Container destroyed or invalid
                    }
                }

                if (!creep.memory.containerId && creep.room.name === creep.memory.remoteRoom) {
                    const structuresMap = global.State.structuresByRoom.get(creep.room.name);
                    if (structuresMap) {
                        const containers = structuresMap.get(STRUCTURE_CONTAINER) || [];
                        if (containers.length > 0) {
                            // Assign hauler to the container with the highest energy
                            let bestContainer = containers[0];
                            let maxEnergy = bestContainer.store ? bestContainer.store.getUsedCapacity('energy') : 0;

                            for (let i = 1; i < containers.length; i++) {
                                const energy = containers[i].store ? containers[i].store.getUsedCapacity('energy') : 0;
                                if (energy > maxEnergy) {
                                    bestContainer = containers[i];
                                    maxEnergy = energy;
                                }
                            }
                            creep.memory.containerId = bestContainer.id;
                        }
                    }
                }
            }
        }
    }
};`);

fs.writeFileSync('src/managers/RemoteEconomyManager.js', code);
