/* global EVENT_OBJECT_DESTROYED, EVENT_ATTACK, EVENT_HEAL, EVENT_BUILD, EVENT_CREATE_CREEP, EVENT_DROP */

module.exports = function stateScanner() {
    if (!global.State?.scannedRooms) return;

    // Pure Event-Driven Consumer Loop
    for (const roomName of global.State.scannedRooms) {
        const room = Game.rooms[roomName];
        if (!room) continue;

        const events = global.State.getEvents ? global.State.getEvents(roomName) : (global.State.eventCache.get(roomName) || []);

        const roomStructures = global.State.structuresByRoom.get(roomName) || new Map();
        const roomLogistics = global.State.logisticsByRoom.get(roomName) || new Map();

        const roomHostiles = global.State.hostilesByRoom.get(roomName) || new Map();
        const roomDropped = global.State.droppedByRoom.get(roomName) || new Map();

        const roomSites = global.State.sitesByRoom.get(roomName);
        const roomTombstones = global.State.tombstonesByRoom.get(roomName);
        const roomRuins = global.State.ruinsByRoom.get(roomName);

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
                roomLogistics.delete(event.objectId);

                if (typeToRemove) {
                    let structMapOrArr = roomStructures.get(typeToRemove);
                    if (structMapOrArr) {
                        if (structMapOrArr instanceof Map) {
                            structMapOrArr.delete(event.objectId);
                        } else if (Array.isArray(structMapOrArr)) {
                            const idx = structMapOrArr.findIndex(s => s.id === event.objectId);
                            if (idx !== -1) structMapOrArr.splice(idx, 1);
                        }
                    }
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

                if (roomTombstones) {
                    if (roomTombstones instanceof Map) {
                        roomTombstones.delete(event.objectId);
                    } else if (Array.isArray(roomTombstones)) {
                        const idx = roomTombstones.findIndex(s => s.id === event.objectId);
                        if (idx !== -1) roomTombstones.splice(idx, 1);
                    }
                }

                if (roomRuins) {
                    if (roomRuins instanceof Map) {
                        roomRuins.delete(event.objectId);
                    } else if (Array.isArray(roomRuins)) {
                        const idx = roomRuins.findIndex(s => s.id === event.objectId);
                        if (idx !== -1) roomRuins.splice(idx, 1);
                    }
                }
            } else if (event.event === EVENT_ATTACK || event.event === EVENT_HEAL) {
                let actor = Game.getObjectById(event.objectId);
                let target = event.data && event.data.targetId ? Game.getObjectById(event.data.targetId) : null;

                if (actor && actor.my === false) {
                    roomHostiles.set(actor.id, actor);
                }
                if (target && target.my === false) {
                    roomHostiles.set(target.id, target);
                }
            } else if (typeof EVENT_CREATE_CREEP !== 'undefined' && event.event === EVENT_CREATE_CREEP) {
                let creep = Game.getObjectById(event.objectId);
                if (creep && creep.my === false) {
                    roomHostiles.set(creep.id, creep);
                }
            } else if (typeof EVENT_BUILD !== 'undefined' && event.event === EVENT_BUILD) {
                let buildObj = event.data && event.data.targetId ? Game.getObjectById(event.data.targetId) : null;
                if (!buildObj) buildObj = Game.getObjectById(event.objectId); // Fallback in case objectId is the site

                if (buildObj && buildObj.structureType) {
                    if (!(buildObj instanceof ConstructionSite)) {
                        if (roomSites) {
                            if (roomSites instanceof Map) {
                                for (const [siteId, site] of roomSites.entries()) {
                                    if (site.pos && buildObj.pos && site.pos.x === buildObj.pos.x && site.pos.y === buildObj.pos.y) {
                                        roomSites.delete(siteId);
                                        break;
                                    }
                                }
                            } else if (Array.isArray(roomSites)) {
                                const idx = roomSites.findIndex(s => s.pos && buildObj.pos && s.pos.x === buildObj.pos.x && s.pos.y === buildObj.pos.y);
                                if (idx !== -1) roomSites.splice(idx, 1);
                            }
                        }

                        let structMapOrArr = roomStructures.get(buildObj.structureType);
                        if (!structMapOrArr) {
                            structMapOrArr = new Map();
                            roomStructures.set(buildObj.structureType, structMapOrArr);
                        }

                        if (structMapOrArr instanceof Map) {
                            structMapOrArr.set(buildObj.id, buildObj);
                        } else if (Array.isArray(structMapOrArr)) {
                            if (!structMapOrArr.some(s => s.id === buildObj.id)) {
                                structMapOrArr.push(buildObj);
                            }
                        }
                        global.State.structureCache.set(buildObj.id, buildObj);
                    }
                }
            } else if (typeof EVENT_DROP !== 'undefined' && event.event === EVENT_DROP) {
                let dropObj = Game.getObjectById(event.objectId);
                if (dropObj && dropObj.resourceType) {
                    roomDropped.set(dropObj.id, dropObj);
                }
            }
        }

        // Clean up creeps maps for dead creeps using O(1) logic instead of array iteration
        const roomCreeps = global.State.creepsByRoom.get(roomName) || new Map();
        for (const id of roomCreeps.keys()) {
            const creep = roomCreeps.get(id);
            if (!global.State.creepLookup.has(creep.name)) {
                roomCreeps.delete(id); // Creep died
            }
        }
    }
};
