const eventBus = require('../os/eventBus');

function findParkPos(hubLink, storage, room) {
    const terrain = global.State.roomTerrain.get(room.name);
    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
            if (dx === 0 && dy === 0) continue;
            const tx = hubLink.pos.x + dx;
            const ty = hubLink.pos.y + dy;
            
            // Check if adjacent to storage and walkable
            if (Math.abs(storage.pos.x - tx) <= 1 && Math.abs(storage.pos.y - ty) <= 1) {
                if (terrain && terrain.get(tx, ty) !== TERRAIN_MASK_WALL) {
                    return { x: tx, y: ty, roomName: room.name };
                }
            }
        }
    }
    return { x: hubLink.pos.x, y: hubLink.pos.y, roomName: room.name };
}

function run(room) {
    try {
        const roomCreeps = global.State.creepsByRoom.get(room.name);
        if (!roomCreeps) return;

        const hubManagers = roomCreeps.get('hubManager');
        if (!hubManagers || hubManagers.length === 0) return;

        const structuresMap = global.State.structuresByRoom.get(room.name);
        if (!structuresMap) return;

        const links = structuresMap.get(STRUCTURE_LINK) || [];
        const storages = structuresMap.get(STRUCTURE_STORAGE) || [];
        if (links.length === 0 || storages.length === 0) return;

        const storage = storages[0];
        let hubLink = null;
        let controllerLink = null;

        // O(N) Link Mapping
        for (let i = 0; i < links.length; i++) {
            if (links[i].pos.isNearTo(storage)) {
                hubLink = links[i];
            } else if (room.controller && links[i].pos.inRangeTo(room.controller, 3)) {
                controllerLink = links[i];
            }
        }

        if (!hubLink) return;

        // Publish event to lock out Domestic Haulers
        if (controllerLink) {
            eventBus.publish('LINK_ROUTE_ACTIVE', { roomName: room.name, route: 'controller' });
        }

        // Priority Calculations
        const controllerNeedsEnergy = controllerLink && controllerLink.store.getUsedCapacity(RESOURCE_ENERGY) < 400;
        const hubLinkHasSpace = hubLink.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
        const hubLinkHasEnergy = hubLink.store.getUsedCapacity(RESOURCE_ENERGY) > 0;

        // Assign top-down states
        for (let i = 0; i < hubManagers.length; i++) {
            const creep = hubManagers[i];
            creep.heap = creep.heap || {};

            if (!creep.heap.parkPos) {
                creep.heap.parkPos = findParkPos(hubLink, storage, room);
            }

            if (controllerNeedsEnergy && hubLinkHasSpace) {
                creep.heap.state = 'fill_link';
                creep.heap.targetId = hubLink.id;
                creep.heap.sourceId = storage.id;
            } else if (hubLinkHasEnergy && !controllerNeedsEnergy) {
                creep.heap.state = 'empty_link';
                creep.heap.targetId = storage.id;
                creep.heap.sourceId = hubLink.id;
            } else {
                creep.heap.state = 'idle';
            }
        }
    } catch (e) {
        console.log(`[HubManager Manager Error] Room ${room.name}: ${e.stack}`);
    }
}

module.exports = { run };