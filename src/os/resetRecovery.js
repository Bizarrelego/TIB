class ResetRecovery {
    check() {
        this.checkAndRecover();
    }

    checkAndRecover() {
        if (global.__resetDetected === undefined) {
            global.__resetDetected = true;
            console.log(`[ResetRecovery] VM Reset detected. Rehydrating caches...`);

            this.rehydrateGlobalState();

            if (Memory._recoveryCache) {
                try {
                    const parsed = JSON.parse(Memory._recoveryCache);
                    if (global.Cache) {
                        const targets = ['structures', 'creeps', 'sources'];
                        let rehydrated = false;
                        for (const target of targets) {
                            if (parsed[target] && global.Cache.has(target)) {
                                const targetMap = global.Cache.get(target);
                                for (const key in parsed[target]) {
                                    targetMap.set(key, parsed[target][key]);
                                }
                                rehydrated = true;
                            }
                        }
                        if (rehydrated) {
                            console.log(`[ResetRecovery] Successfully rehydrated ID dictionaries.`);
                        }
                    }
                } catch (e) {
                    console.log(`[ResetRecovery] Failed to parse recovery cache data: ${e.message}`);
                }
            } else {
                console.log(`[ResetRecovery] No recovery cache data found to rehydrate.`);
            }
        }
    }

    /**
     * Iterates through Game objects to rebuild O(1) dictionaries in global.State
     * after a VM reset, preventing ID lookup failures.
     */
    rehydrateGlobalState() {
        if (typeof Game === 'undefined') return;

        if (!global.State) {
            global.State = require('../state/globalState');
        }

        console.log(`[ResetRecovery] Rehydrating O(1) global.State dictionaries...`);

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
    }

    saveState() {
        // Throttle saving to prevent CPU overhead, save every 10 ticks
        if (typeof Game !== 'undefined' && Game.time % 10 !== 0) return;

        if (global.Cache) {
            const targets = ['structures', 'creeps', 'sources'];
            const obj = {};

            for (const target of targets) {
                if (global.Cache.has(target)) {
                    const targetMap = global.Cache.get(target);
                    obj[target] = {};
                    for (const [key, value] of targetMap.entries()) {
                        obj[target][key] = value;
                    }
                }
            }

            Memory._recoveryCache = JSON.stringify(obj);
        }
    }
}

module.exports = new ResetRecovery();
