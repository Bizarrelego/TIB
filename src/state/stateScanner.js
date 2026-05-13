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

        let roomHostiles = global.State.hostilesByRoom.get(roomName);
        if (Array.isArray(roomHostiles)) {
            const newMap = new Map();
            for (const hostile of roomHostiles) {
                if (hostile && hostile.id) newMap.set(hostile.id, hostile);
            }
            roomHostiles = newMap;
            global.State.hostilesByRoom.set(roomName, roomHostiles);
        } else if (!(roomHostiles instanceof Map)) {
            roomHostiles = new Map();
            global.State.hostilesByRoom.set(roomName, roomHostiles);
        }

        let roomDropped = global.State.droppedByRoom.get(roomName);
        if (Array.isArray(roomDropped)) {
            const newMap = new Map();
            for (const dropped of roomDropped) {
                if (dropped && dropped.id) newMap.set(dropped.id, dropped);
            }
            roomDropped = newMap;
            global.State.droppedByRoom.set(roomName, roomDropped);
        } else if (!(roomDropped instanceof Map)) {
            roomDropped = new Map();
            global.State.droppedByRoom.set(roomName, roomDropped);
        }

        const roomSites = global.State.sitesByRoom.get(roomName);
        const roomTombstones = global.State.tombstonesByRoom.get(roomName);
        const roomRuins = global.State.ruinsByRoom.get(roomName);

        for (const event of events) {
            let object = Game.getObjectById(event.objectId);
            if (!object && event.data && event.data.targetId) {
                object = Game.getObjectById(event.data.targetId);
            }

            if (event.event === EVENT_OBJECT_DESTROYED) {
                global.State.structureCache.delete(event.objectId);
                roomHostiles.delete(event.objectId);
                roomLogistics.delete(event.objectId);

                if (roomSites && Array.isArray(roomSites)) {
                    const idx = roomSites.findIndex(s => s.id === event.objectId);
                    if (idx !== -1) roomSites.splice(idx, 1);
                }
                roomDropped.delete(event.objectId);
                if (roomTombstones && Array.isArray(roomTombstones)) {
                    const idx = roomTombstones.findIndex(s => s.id === event.objectId);
                    if (idx !== -1) roomTombstones.splice(idx, 1);
                }
                if (roomRuins && Array.isArray(roomRuins)) {
                    const idx = roomRuins.findIndex(s => s.id === event.objectId);
                    if (idx !== -1) roomRuins.splice(idx, 1);
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
                // If a structure was built
                let target = event.data && event.data.targetId ? Game.getObjectById(event.data.targetId) : null;
                if (!target) target = Game.getObjectById(event.objectId);

                // Also check if object is the target itself
                if (object && object.structureType) target = object;

                if (target && target.structureType) {
                    // It could be a Structure (finished) or ConstructionSite (progressing)
                    // The prompt says: "If a structure was built (object && object.structureType), remove the corresponding construction site from roomSites. Add the newly built structure to roomStructures... Add the new structure to global.State.structureCache."
                    // Actually, let's just do exactly as asked with `object && object.structureType` where object is resolved from event.objectId
                    let buildObj = Game.getObjectById(event.objectId) || (event.data && Game.getObjectById(event.data.targetId));
                    if (buildObj && buildObj.structureType) {
                        if (roomSites && Array.isArray(roomSites)) {
                            // Find and remove construction site by position or ID
                            const idx = roomSites.findIndex(s => s.pos && buildObj.pos && s.pos.x === buildObj.pos.x && s.pos.y === buildObj.pos.y);
                            if (idx !== -1) roomSites.splice(idx, 1);

                            const idx2 = roomSites.findIndex(s => s.id === buildObj.id);
                            if (idx2 !== -1) roomSites.splice(idx2, 1);
                        }

                        if (!(buildObj instanceof ConstructionSite)) {
                            let structArray = roomStructures.get(buildObj.structureType);
                            if (!structArray) {
                                structArray = [];
                                roomStructures.set(buildObj.structureType, structArray); // Ensure the new array is set
                            }
                            structArray.push(buildObj); // Add the new structure
                            global.State.structureCache.set(buildObj.id, buildObj); // Add to global cache
                        }
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
