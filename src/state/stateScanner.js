/* global EVENT_CREATE_CREEP, EVENT_DROP */
const globalState = require('./globalState');

/**
 * Caches enemy combat profile to prevent O(N) array scans during tick loops.
 * @param {Creep} creep - The hostile creep to cache
 */
function cacheEnemyProfile(creep) {
    if (!global.State.enemyProfiles) global.State.enemyProfiles = new Map();
    if (!global.State.enemyProfiles.has(creep.id)) {
        let isDangerous = true;
        let healParts = 0;
        let attackParts = 0;
        if (creep.body) {
            isDangerous = false;
            for (let i = 0; i < creep.body.length; i++) {
                const type = creep.body[i].type;
                if (type === ATTACK || type === RANGED_ATTACK) {
                    isDangerous = true;
                    attackParts++;
                } else if (type === HEAL) {
                    healParts++;
                }
            }
        }
        global.State.enemyProfiles.set(creep.id, { isDangerous, healParts, attackParts });
    }
}

/**
 * Updates the structure's bucket in the O(1) repair queue.
 * @param {Structure} struct
 */
function updateStructureBucket(struct) {
    if (!struct || (struct.structureType !== STRUCTURE_RAMPART && struct.structureType !== STRUCTURE_WALL && struct.structureType !== STRUCTURE_ROAD)) return;
    const roomName = struct.pos.roomName;

    if (!global.State.repairQueues) global.State.repairQueues = new Map();
    let queue = global.State.repairQueues.get(roomName);
    if (!queue) {
        queue = new Array(100);
        for (let i = 0; i < 100; i++) queue[i] = new Set();
        global.State.repairQueues.set(roomName, queue);
    }

    const newBucket = Math.floor((struct.hits / struct.hitsMax) * 99);
    if (!global.State.structureBucketMap) global.State.structureBucketMap = new Map();
    const oldBucket = global.State.structureBucketMap.get(struct.id);

    if (oldBucket !== newBucket) {
        if (oldBucket !== undefined && queue[oldBucket]) queue[oldBucket].delete(struct.id);
        if (queue[newBucket]) queue[newBucket].add(struct.id);
        global.State.structureBucketMap.set(struct.id, newBucket);
    }
}

module.exports = { scan: function stateScanner() {
    if (!global.State?.scannedRooms) return;

    if (!global.State.roomRuins) global.State.roomRuins = new Map();
    if (!global.State.roomTombstones) global.State.roomTombstones = new Map();
    if (!global.State.roomDropped) global.State.roomDropped = new Map();

    // Pure Event-Driven Consumer Loop
    for (const roomName of global.State.scannedRooms) {
        const roomData = globalState.read(roomName) || { events: [] };
        if (!globalState.read(roomName)) {
            globalState.write(roomName, roomData);
        }

        const events = global.State.getEvents ? global.State.getEvents(roomName) : (global.State.eventCache.get(roomName) || []);

        const roomStructures = global.State.structuresByRoom.get(roomName) || new Map();
        const roomLogistics = global.State.logisticsByRoom.get(roomName) || new Map();

        let roomHostiles = global.State.hostilesByRoom.get(roomName);
        if (!roomHostiles) {
            roomHostiles = new Map();
            global.State.hostilesByRoom.set(roomName, roomHostiles);
        }


        if (!global.State.roomDropped.has(roomName)) {
            let droppedMap = global.State.droppedByRoom ? global.State.droppedByRoom.get(roomName) : null;
            if (droppedMap) {
                global.State.roomDropped.set(roomName, droppedMap);
            } else {
                global.State.roomDropped.set(roomName, new Map());
            }
        }
        let roomDropped = global.State.roomDropped.get(roomName);
        global.State.droppedByRoom = global.State.roomDropped;

        if (!global.State.roomTombstones.has(roomName)) {
            let tombstonesMap = global.State.tombstonesByRoom ? global.State.tombstonesByRoom.get(roomName) : null;
            if (tombstonesMap) {
                global.State.roomTombstones.set(roomName, tombstonesMap);
            } else {
                global.State.roomTombstones.set(roomName, new Map());
            }
        }
        let roomTombstones = global.State.roomTombstones.get(roomName);
        global.State.tombstonesByRoom = global.State.roomTombstones;

        if (!global.State.roomRuins.has(roomName)) {
            let ruinsMap = global.State.ruinsByRoom ? global.State.ruinsByRoom.get(roomName) : null;
            if (ruinsMap) {
                global.State.roomRuins.set(roomName, ruinsMap);
            } else {
                global.State.roomRuins.set(roomName, new Map());
            }
        }
        let roomRuins = global.State.roomRuins.get(roomName);
        global.State.ruinsByRoom = global.State.roomRuins;

        let roomSites = global.State.sitesByRoom.get(roomName);
        if (!roomSites) {
            roomSites = new Map();
            global.State.sitesByRoom.set(roomName, roomSites);
        }

        // Bootstrap repair queue logic without roomObj.find
        if (!global.State.repairQueues) global.State.repairQueues = new Map();
        if (!global.State.repairQueues.has(roomName)) {
            let queue = new Array(100);
            for (let i = 0; i < 100; i++) queue[i] = new Set();
            global.State.repairQueues.set(roomName, queue);

            // Initialize O(1) Logistics Cache
            if (!global.State.needyExtensions) global.State.needyExtensions = new Set();

            if (roomStructures) {
                for (const structsOfType of roomStructures.values()) {
                    for (const struct of structsOfType.values()) {
                        updateStructureBucket(struct);

                        if (struct.structureType === STRUCTURE_SPAWN || struct.structureType === STRUCTURE_EXTENSION) {
                            if (struct.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                                global.State.needyExtensions.add(struct.id);
                            }
                        }
                    }
                }
            }
        }

        for (const event of events) {
            let object = Game.getObjectById(event.objectId);
            if (!object && event.data && event.data.targetId) {
                object = Game.getObjectById(event.data.targetId);
            }

            if (event.event === EVENT_OBJECT_DESTROYED) {
                const cachedObj = global.State.structureCache.get(event.objectId);
                const typeToRemove = (event.data && event.data.type) || (cachedObj && cachedObj.structureType);

                global.State.structureCache.delete(event.objectId);
                roomHostiles.delete(event.objectId);
                if (global.State.enemyProfiles) {
                    global.State.enemyProfiles.delete(event.objectId);
                }
                roomLogistics.delete(event.objectId);

                if (typeToRemove) {
                    let structMap = roomStructures.get(typeToRemove);
                    if (structMap) structMap.delete(event.objectId);
                    if (global.State.needyExtensions) global.State.needyExtensions.delete(event.objectId);
                }

                if (roomSites) {
                    if (roomSites instanceof Map) {
                        roomSites.delete(event.objectId);
                    } else if (Array.isArray(roomSites)) {
                        const idx = roomSites.findIndex(s => s.id === event.objectId);
                        if (idx !== -1) roomSites.splice(idx, 1);
                    }
                }
                roomDropped.delete(event.objectId);
                roomTombstones.delete(event.objectId);
                roomRuins.delete(event.objectId);

                if (global.State.structureBucketMap && global.State.structureBucketMap.has(event.objectId)) {
                    const oldBucket = global.State.structureBucketMap.get(event.objectId);
                    const queue = global.State.repairQueues.get(roomName);
                    if (queue && queue[oldBucket]) queue[oldBucket].delete(event.objectId);
                    global.State.structureBucketMap.delete(event.objectId);
                }

                if (event.data && event.data.type === 'creep') {
                    const creepName = event.data.name;
                    const deadCreep = global.State.creepLookup.get(creepName);

                    global.State.creepLookup.delete(creepName);

                    if (deadCreep && deadCreep.pos && deadCreep.pos.roomName) {
                        const roomCreeps = global.State.creepsByRoom.get(deadCreep.pos.roomName);
                        if (roomCreeps) {
                            const role = deadCreep.memory && deadCreep.memory.role ? deadCreep.memory.role : 'default';
                            const roleCreeps = roomCreeps.get(role);
                            if (roleCreeps && Array.isArray(roleCreeps)) {
                                const idx = roleCreeps.findIndex(c => c.name === creepName);
                                if (idx !== -1) roleCreeps.splice(idx, 1);
                            }
                        }
                    }
                    roomHostiles.delete(event.objectId);
                }
            } else if (event.event === EVENT_ATTACK || event.event === EVENT_HEAL) {
                let actor = Game.getObjectById(event.objectId);
                let target = event.data && event.data.targetId ? Game.getObjectById(event.data.targetId) : null;

                if (actor && actor.my === false && actor.owner && actor.owner.username !== 'Invader') {
                    roomHostiles.set(actor.id, actor);
                    cacheEnemyProfile(actor);
                }
                if (target && target.my === false && target.owner && target.owner.username !== 'Invader') {
                    roomHostiles.set(target.id, target);
                    cacheEnemyProfile(target);
                }
                if (target && target.hits !== undefined) {
                    updateStructureBucket(target);
                }
            } else if (event.event === EVENT_TRANSFER || event.event === EVENT_WITHDRAW) {
                // Re-evaluate capacity status for needy structures
                const targetId = event.data && event.data.targetId ? event.data.targetId : null;
                if (targetId && global.State.needyExtensions) {
                    const targetObj = Game.getObjectById(targetId);
                    if (targetObj && (targetObj.structureType === STRUCTURE_SPAWN || targetObj.structureType === STRUCTURE_EXTENSION)) {
                        if (targetObj.store.getFreeCapacity(RESOURCE_ENERGY) > 0) global.State.needyExtensions.add(targetId);
                        else global.State.needyExtensions.delete(targetId);
                    }
                }
            } else if (event.event === EVENT_CREATE_CREEP) {
                let newCreep = Game.getObjectById(event.objectId);
                if (newCreep) {
                    if (newCreep.my === false) {
                        roomHostiles.set(newCreep.id, newCreep);
                        cacheEnemyProfile(newCreep);
                    } else {
                        global.State.creepLookup.set(newCreep.name, newCreep);
                        const roomName = newCreep.pos.roomName;
                        let roomCreeps = global.State.creepsByRoom.get(roomName);
                        if (!roomCreeps) {
                            roomCreeps = new Map();
                            global.State.creepsByRoom.set(roomName, roomCreeps);
                        }
                        const role = newCreep.memory && newCreep.memory.role ? newCreep.memory.role : 'default';
                        let roleCreeps = roomCreeps.get(role);
                        if (!roleCreeps) {
                            roleCreeps = [];
                            roomCreeps.set(role, roleCreeps);
                        }
                        roleCreeps.push(newCreep);
                    }
                }
            } else if (typeof EVENT_BUILD !== 'undefined' && event.event === EVENT_BUILD) {
                let buildObj = event.data && event.data.targetId ? Game.getObjectById(event.data.targetId) : null;
                if (!buildObj) buildObj = Game.getObjectById(event.objectId); // Fallback in case objectId is the site

                if (buildObj && buildObj.structureType) {
                    if (!(buildObj instanceof ConstructionSite)) {
                        const siteIdToRemove = event.data && event.data.targetId ? event.data.targetId : event.objectId;
                        if (roomSites) {
                            if (roomSites instanceof Map) {
                                roomSites.delete(siteIdToRemove);
                            } else if (Array.isArray(roomSites)) {
                                const idx = roomSites.findIndex(s => s.id === siteIdToRemove);
                                if (idx !== -1) roomSites.splice(idx, 1);
                            }
                        }

                        let structsOfType = roomStructures.get(buildObj.structureType);
                        if (!structsOfType) {
                            structsOfType = new Map();
                            roomStructures.set(buildObj.structureType, structsOfType);
                        }

                        structsOfType.set(buildObj.id, buildObj);
                        global.State.structureCache.set(buildObj.id, buildObj);
                    }
                }
            } else if (event.event === EVENT_DROP) {
                let dropObj = Game.getObjectById(event.objectId);
                if (dropObj && dropObj.resourceType) {
                    roomDropped.set(dropObj.id, dropObj);
                }
            } else if (typeof EVENT_REPAIR !== 'undefined' && event.event === EVENT_REPAIR) {
                let target = event.data && event.data.targetId ? Game.getObjectById(event.data.targetId) : null;
                if (target && target.hits !== undefined) {
                    updateStructureBucket(target);
                }
            }
        }

        // Prune Empty Persistent Objects
        const ruinsMap = global.State.roomRuins.get(roomName);
        if (ruinsMap) {
            for (const id of ruinsMap.keys()) {
                const liveObj = Game.getObjectById(id);
                if (!liveObj || (liveObj.store && liveObj.store[RESOURCE_ENERGY] === 0)) {
                    ruinsMap.delete(id);
                }
            }
        }
        const tombstonesMap = global.State.roomTombstones.get(roomName);
        if (tombstonesMap) {
            for (const id of tombstonesMap.keys()) {
                const liveObj = Game.getObjectById(id);
                if (!liveObj || (liveObj.store && liveObj.store[RESOURCE_ENERGY] === 0)) {
                    tombstonesMap.delete(id);
                }
            }
        }
        const droppedMap = global.State.roomDropped.get(roomName);
        if (droppedMap) {
            for (const id of droppedMap.keys()) {
                const liveObj = Game.getObjectById(id);
                if (!liveObj || (liveObj.amount !== undefined && liveObj.amount === 0)) {
                    droppedMap.delete(id);
                }
            }
        }
    }
} };
