class GlobalStateManager {
    constructor() {
        this.heapCache = new Map();
        this.isRehydrated = false;
        this.managers = new Map();
        this.creepsByRole = new Map();
        this.creepsByRoom = new Map();
        this.structuresByRoom = new Map();
        this.hostilesByRoom = new Map();
        this.logisticsByRoom = new Map();
        this.creepLookup = new Map();
        this.sourcesByRoom = new Map();
        this.spawnsByRoom = new Map();
        this.controllersByRoom = new Map();
        this.sitesByRoom = new Map();
        this.mineralsByRoom = new Map();
        this.rooms = new Map();
        this.creeps = new Map();
        this.structures = new Map();
        this.aggressionState = 'Growth';
        this.sourceAssignments = new Map();
        this.miningSpotsByRoom = new Map();
    }

    registerManager(name, instance) {
        this.managers.set(name, instance);
    }

    getManager(name) {
        return this.managers.get(name);
    }

    rehydrate() {
        if (this.isRehydrated) return;

        if (typeof RawMemory !== 'undefined' && RawMemory.segments) {
            for (const segmentId in RawMemory.segments) {
                const segmentData = RawMemory.segments[segmentId];
                if (segmentData) {
                    try {
                        const parsed = JSON.parse(segmentData);
                        if (typeof parsed === 'object' && parsed !== null) {
                            for (const key in parsed) {
                                this.heapCache.set(key, parsed[key]);
                            }
                        }
                    } catch (e) {
                        this.heapCache.set(`segment_${segmentId}`, segmentData);
                    }
                }
            }
        }

        // IMPROVEMENT: Guarantee heap object initialization via proxy for all creeps.
        // Reason: Prevents undefined reading in DeadlockEngine and TrafficManager if a creep's heap hasn't been accessed yet this tick.
        if (typeof Game !== 'undefined' && Game.creeps) {
            for (const creepName in Game.creeps) {
                const creep = Game.creeps[creepName];
                if (creep) {
                    // Just accessing the property triggers the getter in memoryProxy.js
                    // which sets up the object in the cache registry if it doesn't exist.
                    // eslint-disable-next-line no-unused-expressions
                    creep.heap;
                }
            }
        }

        this.isRehydrated = true;
    }

    read(key) {
        return this.heapCache.get(key);
    }

    write(key, data) {
        this.heapCache.set(key, data);
    }

    get(key) {
        return this.heapCache.get(key);
    }

    set(key, value) {
        this.heapCache.set(key, value);
    }

    has(key) {
        return this.heapCache.has(key);
    }

    delete(key) {
        this.heapCache.delete(key);
    }

    scan() {
        // Tick slicing state scanner entry point
    }

    update() {
        if (typeof Game === 'undefined') return;

        // Clear per-tick O(1) collections before populating
        this.rooms.clear();
        this.creeps.clear();
        this.structures.clear();
        this.creepsByRoom.clear();
        this.structuresByRoom.clear();
        this.spawnsByRoom.clear();
        this.sitesByRoom.clear();
        this.creepLookup.clear();

        if (Game.rooms) {
            for (const roomName in Game.rooms) {
                this.rooms.set(roomName, Game.rooms[roomName]);
            }
        }

        if (Game.creeps) {
            for (const creepName in Game.creeps) {
                const creep = Game.creeps[creepName];
                this.creeps.set(creepName, creep);
                this.creepLookup.set(creepName, creep);

                if (creep.pos && creep.pos.roomName) {
                    const roomName = creep.pos.roomName;
                    let roomCreeps = this.creepsByRoom.get(roomName);
                    if (!roomCreeps) {
                        roomCreeps = new Map();
                        this.creepsByRoom.set(roomName, roomCreeps);
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
                this.structures.set(structId, struct);

                if (struct.pos && struct.pos.roomName) {
                    const roomName = struct.pos.roomName;
                    let roomStructures = this.structuresByRoom.get(roomName);
                    if (!roomStructures) {
                        roomStructures = new Map();
                        this.structuresByRoom.set(roomName, roomStructures);
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
                    let roomSpawns = this.spawnsByRoom.get(roomName);
                    if (!roomSpawns) {
                        roomSpawns = new Map();
                        this.spawnsByRoom.set(roomName, roomSpawns);
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
                    let roomSites = this.sitesByRoom.get(roomName);
                    if (!roomSites) {
                        roomSites = new Map();
                        this.sitesByRoom.set(roomName, roomSites);
                    }
                    roomSites.set(siteId, site);
                }
            }
        }
    }

    clear() {
        this.heapCache.clear();
        this.managers.clear();
        this.creepsByRole.clear();
        this.creepsByRoom.clear();
        this.structuresByRoom.clear();
        this.hostilesByRoom.clear();
        this.logisticsByRoom.clear();
        this.creepLookup.clear();
        this.sourcesByRoom.clear();
        this.spawnsByRoom.clear();
        this.controllersByRoom.clear();
        this.sitesByRoom.clear();
        this.mineralsByRoom.clear();
        this.aggressionState = 'Growth';
        this.sourceAssignments.clear();
        this.miningSpotsByRoom.clear();

        if (this.scannedRooms) this.scannedRooms.clear();
        if (this.rooms) this.rooms.clear();
        if (this.creeps) this.creeps.clear();
        if (this.structures) this.structures.clear();
        if (this.eventCache) this.eventCache.clear();

        this.isRehydrated = false;
    }
}

module.exports = new GlobalStateManager();
