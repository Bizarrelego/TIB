/**
 * @file GlobalStateRehydrator.js
 * @description Orchestrates the rehydration of global state components after a VM reset.
 */

class GlobalStateRehydrator {
    /**
     * Iterates through Game objects to rebuild O(1) dictionaries in global.State
     * after a VM reset, preventing ID lookup failures, and coordinates other rehydration tasks.
     */
    rehydrateGlobalState() {
        if (typeof Game === 'undefined') return;

        if (!global.State) {
            global.State = require('../state/globalState');
        }

        console.log(`[GlobalStateRehydrator] Rehydrating O(1) global.State dictionaries...`);

        if (Game.rooms) {
            for (const roomName in Game.rooms) {
                const room = Game.rooms[roomName];
                global.State.rooms.set(roomName, room);
            }
        }

        if (Game.creeps) {
            for (const creepName in Game.creeps) {
                const creep = Game.creeps[creepName];
                global.State.creeps.set(creepName, creep);

                if (creep.pos && creep.pos.roomName) {
                    const roomName = creep.pos.roomName;
                    let roomCreeps = global.State.creepsByRoom.get(roomName);
                    if (!roomCreeps) {
                        roomCreeps = new Map();
                        global.State.creepsByRoom.set(roomName, roomCreeps);
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
                global.State.structures.set(structId, struct);

                if (struct.pos && struct.pos.roomName) {
                    const roomName = struct.pos.roomName;
                    let roomStructures = global.State.structuresByRoom.get(roomName);
                    if (!roomStructures) {
                        roomStructures = new Map();
                        global.State.structuresByRoom.set(roomName, roomStructures);
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
                    let roomSpawns = global.State.spawnsByRoom.get(roomName);
                    if (!roomSpawns) {
                        roomSpawns = new Map();
                        global.State.spawnsByRoom.set(roomName, roomSpawns);
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
                    let roomSites = global.State.sitesByRoom.get(roomName);
                    if (!roomSites) {
                        roomSites = new Map();
                        global.State.sitesByRoom.set(roomName, roomSites);
                    }
                    roomSites.set(siteId, site);
                }
            }
        }

        // Call globalState rehydration logic here too.
        if (typeof global.State.rehydrate === 'function') {
            global.State.rehydrate();
        }
    }
}

module.exports = new GlobalStateRehydrator();
