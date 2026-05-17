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

module.exports = function stateScanner() {
    if (!global.State?.scannedRooms) return;

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

        let requiresSync = false;

        let roomDropped = global.State.droppedByRoom.get(roomName);
        if (!roomDropped) {
            roomDropped = new Map();
            global.State.droppedByRoom.set(roomName, roomDropped);
            requiresSync = true;
        }

        let roomSites = global.State.sitesByRoom.get(roomName);
        if (!roomSites) {
            roomSites = new Map();
            global.State.sitesByRoom.set(roomName, roomSites);
        }

        let roomTombstones = global.State.tombstonesByRoom.get(roomName);
        if (!roomTombstones) {
            roomTombstones = new Map();
            global.State.tombstonesByRoom.set(roomName, roomTombstones);
            requiresSync = true;
        }

        let roomRuins = global.State.ruinsByRoom.get(roomName);
        if (!roomRuins) {
            roomRuins = new Map();
            global.State.ruinsByRoom.set(roomName, roomRuins);
            requiresSync = true;
        }

        if (requiresSync && typeof Game !== 'undefined' && Game.rooms[roomName]) {
            const roomObj = Game.rooms[roomName];
            
            roomDropped.clear();
            const dropped = roomObj.find(FIND_DROPPED_RESOURCES);
            for (let i = 0; i < dropped.length; i++) roomDropped.set(dropped[i].id, dropped[i]);

            roomTombstones.clear();
            const tombstones = roomObj.find(FIND_TOMBSTONES);
            for (let i = 0; i < tombstones.length; i++) roomTombstones.set(tombstones[i].id, tombstones[i]);

            roomRuins.clear();
            const ruins = roomObj.find(FIND_RUINS);
            for (let i = 0; i < ruins.length; i++) roomRuins.set(ruins[i].id, ruins[i]);

            // Bootstrap repair queue logic
            if (!global.State.repairQueues) global.State.repairQueues = new Map();
            let queue = new Array(100);
            for (let i = 0; i < 100; i++) queue[i] = new Set();
            global.State.repairQueues.set(roomName, queue);
            const structs = roomObj.find(FIND_STRUCTURES);
            for (let i = 0; i < structs.length; i++) updateStructureBucket(structs[i]);

            // Initialize O(1) Logistics Cache
            if (!global.State.needyExtensions) global.State.needyExtensions = new Set();
            for (let i = 0; i < structs.length; i++) {
                if (structs[i].structureType === STRUCTURE_SPAWN || structs[i].structureType === STRUCTURE_EXTENSION) {
                    if (structs[i].store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                        global.State.needyExtensions.add(structs[i].id);
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

                roomSites.delete(event.objectId);
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
                        if (roomSites && Array.isArray(roomSites)) {
                            const siteIdToRemove = event.data && event.data.targetId ? event.data.targetId : event.objectId;
                            const siteIdx = roomSites.findIndex(s => s.id === siteIdToRemove);
                            if (siteIdx !== -1) {
                                roomSites.splice(siteIdx, 1);
                            }
                        } else if (roomSites instanceof Map) {
                            const siteIdToRemove = event.data && event.data.targetId ? event.data.targetId : event.objectId;
                            roomSites.delete(siteIdToRemove);
                        }
                        const siteIdToRemove = event.data && event.data.targetId ? event.data.targetId : event.objectId;
                        roomSites.delete(siteIdToRemove);

                        let structsOfType = roomStructures.get(buildObj.structureType);
                        if (!structsOfType) {
                            structsOfType = new Map();
                            roomStructures.set(buildObj.structureType, structsOfType);
                        }

                        if (structsOfType instanceof Map) {
                            structsOfType.set(buildObj.id, buildObj);
                        } else if (Array.isArray(structsOfType)) {
                            // Fallback just in case array logic is active, but Map should be the standard.
                            if (!structsOfType.some(s => s.id === buildObj.id)) {
                                structsOfType.push(buildObj);
                            }
                        }

                        structsOfType.set(buildObj.id, buildObj);
                        global.State.structureCache.set(buildObj.id, buildObj);
                    }
                }
            } else if (event.event === EVENT_DROP) {
                let dropObj = Game.getObjectById(event.objectId);
                if (dropObj && dropObj.resourceType) {
                    if (roomDropped && Array.isArray(roomDropped)) {
                        roomDropped.push(dropObj);
                    } else if (roomDropped instanceof Map) {
                        roomDropped.set(dropObj.id, dropObj);
                    }
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
        if (roomRuins) {
            for (const id of roomRuins.keys()) {
                const liveObj = Game.getObjectById(id);
                if (!liveObj || (liveObj.store && liveObj.store[RESOURCE_ENERGY] === 0)) {
                    roomRuins.delete(id);
                }
            }
        }
        if (roomTombstones) {
            for (const id of roomTombstones.keys()) {
                const liveObj = Game.getObjectById(id);
                if (!liveObj || (liveObj.store && liveObj.store[RESOURCE_ENERGY] === 0)) {
                    roomTombstones.delete(id);
                }
            }
        }
        if (roomDropped) {
            for (const id of roomDropped.keys()) {
                const liveObj = Game.getObjectById(id);
                if (!liveObj || (liveObj.amount !== undefined && liveObj.amount === 0)) {
                    roomDropped.delete(id);
                }
            }
        }
    }
};
