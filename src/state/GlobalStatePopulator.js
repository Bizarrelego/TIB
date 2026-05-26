const stateScanner = require('./stateScanner');

class GlobalStatePopulator {
    /**
     * Populates the global state dictionaries exactly once per tick.
     * @param {Object} state - The global state instance to populate.
     */

    populate(state) {
        if (typeof Game === 'undefined') return;

        // Clear per-tick O(1) collections before populating
        state.rooms.clear();
        state.creeps.clear();
        state.structures.clear();
        state.creepsByRoom.clear();
        state.structuresByRoom.clear();
        state.spawnsByRoom.clear();
        state.sitesByRoom.clear();
        state.creepLookup.clear();

        state.creepsById.clear();
        state.structuresByType.clear();
        state.flags.clear();
        state.flagsByRoom.clear();
        state.resources.clear();
        state.constructionSites.clear();
        state.constructionSitesByType.clear();
        state.spawns.clear();

        if (Game.rooms) {
            for (const roomName in Game.rooms) {
                const room = Game.rooms[roomName];
                state.rooms.set(roomName, room);


            }
        }

        if (Game.creeps) {
            for (const creepName in Game.creeps) {
                const creep = Game.creeps[creepName];
                state.creeps.set(creepName, creep);
                state.creepLookup.set(creepName, creep);
                state.creepsById.set(creep.id, creep);

                if (creep.pos && creep.pos.roomName) {
                    const roomName = creep.pos.roomName;
                    let roomCreeps = state.creepsByRoom.get(roomName);
                    if (!roomCreeps) {
                        roomCreeps = new Map();
                        state.creepsByRoom.set(roomName, roomCreeps);
                    }
                    const role = creep.memory && creep.memory.role ? creep.memory.role : 'default';
                    let roleCreeps = roomCreeps.get(role);
                    if (!roleCreeps) {
                        roleCreeps = [];
                        roomCreeps.set(role, roleCreeps);
                    }
                    roleCreeps.push(creep);
                }
            }
        }

        if (Game.structures) {
            for (const structId in Game.structures) {
                const struct = Game.structures[structId];
                state.structures.set(structId, struct);

                let structsOfTypeGlobal = state.structuresByType.get(struct.structureType);
                if (!structsOfTypeGlobal) {
                    structsOfTypeGlobal = new Map();
                    state.structuresByType.set(struct.structureType, structsOfTypeGlobal);
                }
                structsOfTypeGlobal.set(structId, struct);

                if (struct.pos && struct.pos.roomName) {
                    const roomName = struct.pos.roomName;
                    let roomStructures = state.structuresByRoom.get(roomName);
                    if (!roomStructures) {
                        roomStructures = new Map();
                        state.structuresByRoom.set(roomName, roomStructures);
                    }
                    let structsOfType = roomStructures.get(struct.structureType);
                    if (!structsOfType) {
                        structsOfType = new Map();
                        roomStructures.set(struct.structureType, structsOfType);
                    }
                    structsOfType.set(structId, struct);
                }
            }
        }

        if (Game.spawns) {
            for (const spawnName in Game.spawns) {
                const spawn = Game.spawns[spawnName];
                state.spawns.set(spawnName, spawn);
                if (spawn.pos && spawn.pos.roomName) {
                    const roomName = spawn.pos.roomName;
                    let roomSpawns = state.spawnsByRoom.get(roomName);
                    if (!roomSpawns) {
                        roomSpawns = new Map();
                        state.spawnsByRoom.set(roomName, roomSpawns);
                    }
                    roomSpawns.set(spawn.id || spawnName, spawn);
                }
            }
        }

        if (Game.constructionSites) {
            for (const siteId in Game.constructionSites) {
                const site = Game.constructionSites[siteId];
                state.constructionSites.set(siteId, site);

                let sitesOfType = state.constructionSitesByType.get(site.structureType);
                if (!sitesOfType) {
                    sitesOfType = new Map();
                    state.constructionSitesByType.set(site.structureType, sitesOfType);
                }
                sitesOfType.set(siteId, site);
                if (site.pos && site.pos.roomName) {
                    const roomName = site.pos.roomName;
                    let roomSites = state.sitesByRoom.get(roomName);
                    if (!roomSites) {
                        roomSites = new Map();
                        state.sitesByRoom.set(roomName, roomSites);
                    }
                    roomSites.set(siteId, site);
                }
            }
        }

        if (Game.flags) {
            for (const flagName in Game.flags) {
                const flag = Game.flags[flagName];
                state.flags.set(flagName, flag);

                if (flag.pos && flag.pos.roomName) {
                    const roomName = flag.pos.roomName;
                    let roomFlags = state.flagsByRoom.get(roomName);
                    if (!roomFlags) {
                        roomFlags = new Map();
                        state.flagsByRoom.set(roomName, roomFlags);
                    }
                    roomFlags.set(flagName, flag);
                }
            }
        }

        if (Game.resources) {
            for (const resId in Game.resources) {
                state.resources.set(resId, Game.resources[resId]);
            }
        }

        // Calculate global terminal intents
        this.calculateTerminalIntents(state);

        // Delegate to stateScanner to finish event-driven scanning and additional state population
        if (stateScanner && typeof stateScanner.scan === 'function') {
            stateScanner.scan();
        }
    }

    /**
     * Calculates global terminal intents for energy and minerals across all owned rooms.
     * @param {Object} state - The global state instance.
     */
    calculateTerminalIntents(state) {
        if (!state.terminalIntents) {
            state.terminalIntents = new Map();
        } else {
            state.terminalIntents.clear();
        }

        if (!Game.rooms) return;

        const TARGET_ENERGY_BUFFER = 50000;
        const TARGET_MINERAL_AMOUNT = 5000;

        const roomsWithTerminals = [];
        for (const roomName in Game.rooms) {
            const room = Game.rooms[roomName];
            if (room.controller && room.controller.my && room.terminal && room.terminal.my) {
                roomsWithTerminals.push(room);
            }
        }

        for (const room of roomsWithTerminals) {
            if (room.terminal.cooldown > 0) continue;

            const terminal = room.terminal;

            // Manage Energy
            if (terminal.store[RESOURCE_ENERGY] > TARGET_ENERGY_BUFFER + 10000) {
                for (const otherRoom of roomsWithTerminals) {
                    if (otherRoom.name === room.name) continue;

                    if (otherRoom.terminal.store[RESOURCE_ENERGY] < TARGET_ENERGY_BUFFER) {
                        const amountNeeded = TARGET_ENERGY_BUFFER - otherRoom.terminal.store[RESOURCE_ENERGY];
                        const amountToSend = Math.min(amountNeeded, terminal.store[RESOURCE_ENERGY] - TARGET_ENERGY_BUFFER);

                        if (amountToSend > 0) {
                            const cost = Game.market.calcTransactionCost(amountToSend, room.name, otherRoom.name);
                            if (terminal.store[RESOURCE_ENERGY] >= amountToSend + cost) {
                                state.terminalIntents.set(room.name, {
                                    resourceType: RESOURCE_ENERGY,
                                    amount: amountToSend,
                                    targetRoom: otherRoom.name
                                });
                                break; // Only one transfer per room per tick
                            }
                        }
                    }
                }
            }

            // If we already have an intent for this room, skip minerals
            if (state.terminalIntents.has(room.name)) continue;

            // Manage Minerals
            for (const resourceType in terminal.store) {
                if (resourceType === RESOURCE_ENERGY) continue;

                const amount = terminal.store[resourceType];
                if (amount > TARGET_MINERAL_AMOUNT + 1000) {
                    for (const otherRoom of roomsWithTerminals) {
                        if (otherRoom.name === room.name) continue;

                        const otherAmount = otherRoom.terminal.store[resourceType] || 0;
                        if (otherAmount < TARGET_MINERAL_AMOUNT) {
                            const amountNeeded = TARGET_MINERAL_AMOUNT - otherAmount;
                            const amountToSend = Math.min(amountNeeded, amount - TARGET_MINERAL_AMOUNT);

                            if (amountToSend > 0) {
                                const cost = Game.market.calcTransactionCost(amountToSend, room.name, otherRoom.name);
                                if (terminal.store[RESOURCE_ENERGY] >= cost) {
                                    state.terminalIntents.set(room.name, {
                                        resourceType: resourceType,
                                        amount: amountToSend,
                                        targetRoom: otherRoom.name
                                    });
                                    break; // Only one transfer per room per tick
                                }
                            }
                        }
                    }
                    if (state.terminalIntents.has(room.name)) break;
                }
            }
        }
    }

}

module.exports = new GlobalStatePopulator();
