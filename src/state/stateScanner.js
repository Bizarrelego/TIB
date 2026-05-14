/* global EVENT_OBJECT_DESTROYED, EVENT_ATTACK, EVENT_HEAL, EVENT_BUILD, EVENT_CREATE_CREEP, EVENT_DROP */
const globalState = require('./globalState');

module.exports = function stateScanner() {
    if (!global.State?.scannedRooms) return;

    // Pure Event-Driven Consumer Loop
    for (const roomName of global.State.scannedRooms) {
        const room = Game.rooms[roomName];
        if (room && room.fatigue > 0) continue;

        if (global.State.sourcesByRoom) {
            const sources = global.State.sourcesByRoom.get(roomName) || [];
            for (let i = 0; i < sources.length; i++) {
                const source = sources[i];
                if (source.sleep && Game.time < source.nextRegenTick) continue;

                if (source.energy === 0) {
                    source.sleep = true;
                    source.nextRegenTick = Game.time + source.ticksToRegeneration;
                } else {
                    source.sleep = false;
                }
            }
        }

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

        const roomDropped = global.State.droppedByRoom.get(roomName);

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

                if (roomDropped) {
                    if (Array.isArray(roomDropped)) {
                        const idx = roomDropped.findIndex(r => r.id === event.objectId);
                        if (idx !== -1) roomDropped.splice(idx, 1);
                    } else if (roomDropped instanceof Map) {
                        roomDropped.delete(event.objectId);
                    }
                }

                if (roomTombstones) {
                    if (Array.isArray(roomTombstones)) {
                        const idx = roomTombstones.findIndex(s => s.id === event.objectId);
                        if (idx !== -1) roomTombstones.splice(idx, 1);
                    } else if (roomTombstones instanceof Map) {
                        roomTombstones.delete(event.objectId);
                    }
                }

                if (roomRuins) {
                    if (Array.isArray(roomRuins)) {
                        const idx = roomRuins.findIndex(s => s.id === event.objectId);
                        if (idx !== -1) roomRuins.splice(idx, 1);
                    } else if (roomRuins instanceof Map) {
                        roomRuins.delete(event.objectId);
                    }
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
                }
                if (target && target.my === false && target.owner && target.owner.username !== 'Invader') {
                    roomHostiles.set(target.id, target);
                }
            } else if (event.event === EVENT_CREATE_CREEP) {
                let newCreep = Game.getObjectById(event.objectId);
                if (newCreep) {
                    if (newCreep.my === false) {
                        roomHostiles.set(newCreep.id, newCreep);
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
                }
            }
        }
    }
};
