/* global Game, FIND_STRUCTURES, FIND_DROPPED_RESOURCES, FIND_TOMBSTONES, FIND_RUINS */

module.exports = function stateScanner() {
    for (const roomName in Game.rooms) {
        const room = Game.rooms[roomName];
        if (!room) continue;

        if (!global.State.scannedRooms) global.State.scannedRooms = new Set();

        if (!global.State.structuresByRoom.has(roomName)) {
            global.State.structuresByRoom.set(roomName, new Map());
        }
        if (!global.State.creepsByRoom.has(roomName)) {
            global.State.creepsByRoom.set(roomName, new Map());
        }
        if (!global.State.hostilesByRoom.has(roomName)) {
            global.State.hostilesByRoom.set(roomName, new Map());
        }
        if (!global.State.logisticsByRoom.has(roomName)) {
            global.State.logisticsByRoom.set(roomName, new Map());
        }

        const roomStructures = global.State.structuresByRoom.get(roomName);
        const roomHostiles = global.State.hostilesByRoom.get(roomName);
        const roomCreeps = global.State.creepsByRoom.get(roomName);
        const roomLogistics = global.State.logisticsByRoom.get(roomName);

        // Refresh existing caches to prevent frozen game objects
        const refreshCache = (cacheMap) => {
            for (const id of cacheMap.keys()) {
                const freshObj = Game.getObjectById(id);
                if (freshObj) {
                    cacheMap.set(id, freshObj);
                } else {
                    cacheMap.delete(id);
                }
            }
        };

        refreshCache(roomStructures);
        refreshCache(roomHostiles);
        refreshCache(roomLogistics);

        const eventLog = room.getEventLog();
        for (const event of eventLog) {
            if (event.event === EVENT_OBJECT_DESTROYED) {
                const objectId = event.objectId;
                roomStructures.delete(objectId);
                roomHostiles.delete(objectId);
                roomCreeps.delete(objectId);
                roomLogistics.delete(objectId);
            } else if (event.event === EVENT_BUILD) {
                const newStruct = Game.getObjectById(event.data.targetId);
                if (newStruct) roomStructures.set(newStruct.id, newStruct);
            } else if (event.event === EVENT_ATTACK || event.event === EVENT_HEAL) {
                const obj = Game.getObjectById(event.objectId);
                if (obj && !obj.my) roomHostiles.set(obj.id, obj);
            }
        }

        roomCreeps.clear();
        for (const creepName in Game.creeps) {
            const creep = Game.creeps[creepName];
            if (creep.room.name === roomName) {
                roomCreeps.set(creep.id, creep);
            }
        }

        // Initial cache population exactly once per room
        if (!global.State.scannedRooms.has(roomName)) {
            const structures = room.find(FIND_STRUCTURES);
            for (const struct of structures) {
                roomStructures.set(struct.id, struct);
            }

            const droppedEnergy = room.find(FIND_DROPPED_RESOURCES);
            for (const drop of droppedEnergy) roomLogistics.set(drop.id, drop);

            const tombstones = room.find(FIND_TOMBSTONES);
            for (const tomb of tombstones) roomLogistics.set(tomb.id, tomb);

            const ruins = room.find(FIND_RUINS);
            for (const ruin of ruins) roomLogistics.set(ruin.id, ruin);

            global.State.scannedRooms.add(roomName);
        }
    }
};
