/**
 * @file MineralManager.js
 * @description Manages identifying mineral sources, deploying extractors, assigning mineral miners,
 * and managing the transportation of minerals to storage/terminal.
 */

const MiningPlanner = require('../colonies/MiningPlanner');
const SpawnQueueManager = require('./SpawnQueueManager');
const BodyCalc = require('../utils/bodyCalc');

class MineralManager {
    /**
     * Initialize mineral data for a given room.
     * Plugs into MiningPlanner to establish optimal mineral mining spots.
     * @param {string} roomName - The name of the room
     */
    static init(roomName) {
        MiningPlanner.planMineralSpots(roomName);
    }

    /**
     * Executes terminal operations per room based on global intents.
     * @param {Room} room - The room object.
     */
    static run(room) {
        if (!room.controller || room.controller.level < 6) return;

        const minerals = global.State.mineralsByRoom ? global.State.mineralsByRoom.get(room.name) : null;
        if (!minerals || minerals.length === 0) return;

        const structures = global.State.structuresByRoom ? global.State.structuresByRoom.get(room.name) : null;
        const extractors = structures ? structures.get(STRUCTURE_EXTRACTOR) : null;

        const sites = global.State.sitesByRoom ? global.State.sitesByRoom.get(room.name) : null;

        for (const mineral of minerals) {
            let hasExtractor = false;

            // Check for existing extractor
            if (extractors) {
                for (const extractor of extractors.values()) {
                    if (extractor.pos.x === mineral.pos.x && extractor.pos.y === mineral.pos.y) {
                        hasExtractor = true;
                        break;
                    }
                }
            }

            // Check for extractor construction site
            if (!hasExtractor && sites) {
                for (const site of sites) {
                    if (site.structureType === STRUCTURE_EXTRACTOR && site.pos.x === mineral.pos.x && site.pos.y === mineral.pos.y) {
                        hasExtractor = true;
                        break;
                    }
                }
            }

            // Place extractor construction site (Batched Construction Throttling)
            if (!hasExtractor) {
                const activeSitesCount = sites ? sites.length : 0;
                if (activeSitesCount < 3) {
                    room.createConstructionSite(mineral.pos.x, mineral.pos.y, STRUCTURE_EXTRACTOR);
                }
                continue; // Can't mine without extractor
            }

            // If we have an extractor, evaluate mining
            if (mineral.mineralAmount > 0) {
                // Coordinate with Storage and Terminal limits
                let storedMineral = 0;
                if (room.storage) storedMineral += room.storage.store.getUsedCapacity(mineral.mineralType) || 0;
                if (room.terminal) storedMineral += room.terminal.store.getUsedCapacity(mineral.mineralType) || 0;

                const MAX_MINERAL_STORAGE = 100000;
                if (storedMineral >= MAX_MINERAL_STORAGE) continue;

                const roomCreeps = global.State.creepsByRoom ? global.State.creepsByRoom.get(room.name) : null;

                // Properly filter mineralMiners from Map or Array
                let mineralMiners = [];
                if (roomCreeps) {
                    if (roomCreeps instanceof Map) {
                        mineralMiners = roomCreeps.get('mineralMiner') || [];
                    } else if (Array.isArray(roomCreeps)) {
                        mineralMiners = roomCreeps.filter(c => c.memory.role === 'mineralMiner');
                    } else {
                        // Iterating over properties if object
                        for (const key in roomCreeps) {
                            if (roomCreeps[key] && roomCreeps[key].memory && roomCreeps[key].memory.role === 'mineralMiner') {
                                mineralMiners.push(roomCreeps[key]);
                            }
                        }
                    }
                }

                // Spawn a miner if we don't have one
                if (mineralMiners.length === 0) {
                    const body = BodyCalc.calculateMineralMinerBody(room.energyCapacityAvailable);
                    const cost = BodyCalc.getCost(body);
                    const opts = { memory: { role: 'mineralMiner', room: room.name } };
                    SpawnQueueManager.requestSpawn(room.name, 'mineralMiner', body, `mineralMiner_${Game.time}`, opts, cost);
                } else {
                    // Assign mineral to miner
                    for (const miner of mineralMiners) {
                        if (!miner.heap) miner.heap = {};
                        miner.heap.targetId = mineral.id;

                        // Set optimal target position
                        if (!miner.heap.targetPos && global.State.mineralSpotsByRoom) {
                            const spotsMap = global.State.mineralSpotsByRoom.get(room.name);
                            if (spotsMap && spotsMap.has(mineral.id)) {
                                const optimalSpot = spotsMap.get(mineral.id);
                                miner.heap.targetPos = { x: optimalSpot.x, y: optimalSpot.y, roomName: room.name };
                            }
                        }
                    }
                }
            }
        }
    }
}

module.exports = MineralManager;
