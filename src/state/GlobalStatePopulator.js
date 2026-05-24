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

        // Delegate to stateScanner to finish event-driven scanning and additional state population
        if (stateScanner && typeof stateScanner.scan === 'function') {
            stateScanner.scan();
        }
    }

}

module.exports = new GlobalStatePopulator();
