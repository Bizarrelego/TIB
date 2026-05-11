const movement = require('../utils/movement');

function run(room) {
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

    // Identify Hub Link
    let hubLink = null;
    for (let i = 0; i < links.length; i++) {
        if (links[i].pos.isNearTo(storage)) {
            hubLink = links[i];
            break;
        }
    }

    if (!hubLink) return;

    for (let i = 0; i < hubManagers.length; i++) {
        const creep = hubManagers[i];

        try {
            creep.heap = creep.heap || {};
            if (creep.fatigue > 0) continue; // Fatigue gating

            // Determine parkPos: needs to be near both Storage and Hub Link
            if (!creep.heap.parkPos) {
                // Find a tile adjacent to both hubLink and storage
                let foundPos = null;
                for (let dx = -1; dx <= 1; dx++) {
                    for (let dy = -1; dy <= 1; dy++) {
                        if (dx === 0 && dy === 0) continue;
                        const targetX = hubLink.pos.x + dx;
                        const targetY = hubLink.pos.y + dy;

                        // Check if this tile is near the storage
                        if (Math.abs(storage.pos.x - targetX) <= 1 && Math.abs(storage.pos.y - targetY) <= 1) {
                            // Verify it's walkable (for simplicity here, we assume if it's near both it's our designated spot;
                            // a robust check would verify terrain/structures, but planner puts it in an open spot).
                            const terrain = Game.map.getRoomTerrain(room.name);
                            if (terrain.get(targetX, targetY) !== TERRAIN_MASK_WALL) {
                                foundPos = { x: targetX, y: targetY, roomName: room.name };
                                break;
                            }
                        }
                    }
                    if (foundPos) break;
                }
                if (foundPos) {
                    creep.heap.parkPos = foundPos;
                } else {
                    creep.heap.parkPos = { x: hubLink.pos.x, y: hubLink.pos.y, roomName: room.name }; // Fallback
                }
            }

            // Move to position
            if (creep.pos.x !== creep.heap.parkPos.x || creep.pos.y !== creep.heap.parkPos.y) {
                 movement.moveTo(creep, new RoomPosition(creep.heap.parkPos.x, creep.heap.parkPos.y, creep.heap.parkPos.roomName));
                 continue;
            }

            // At hub position, do transfer/withdraw logic
            if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
                // We are empty, withdraw from hub link
                if (hubLink.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                    creep.withdraw(hubLink, RESOURCE_ENERGY);
                }
            } else {
                // We have energy, transfer to storage
                if (storage.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                    creep.transfer(storage, RESOURCE_ENERGY);
                }
            }

        } catch (e) {
            console.log(`[hubManager Error] Room ${room.name}, Creep ${creep.name}: ${e.stack}`);
        }
    }
}

module.exports = { run };
