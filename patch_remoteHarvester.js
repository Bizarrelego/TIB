const fs = require('fs');
let code = fs.readFileSync('src/roles/remoteHarvester.js', 'utf8');

const replacement = `const movement = require('../utils/movement');

/**
 * Executes logic for remoteHarvester role.
 * @param {Room} room The home room of the colony managing these creeps.
 */
function run(room) {
    const roomCreeps = global.State.creepsByRoom.get(room.name);
    if (!roomCreeps) return;

    const remoteHarvesters = roomCreeps.get('remoteHarvester');
    if (!remoteHarvesters || remoteHarvesters.length === 0) return;

    for (const creep of remoteHarvesters) {
        try {
            if (creep.fatigue > 0) continue; // Fatigue gating

            const targetRoomName = creep.memory.targetRoom;
            if (!targetRoomName) continue;

            // Check hostiles
            if (global.State.hostilesByRoom && global.State.hostilesByRoom.has(creep.room.name)) {
                const hostiles = global.State.hostilesByRoom.get(creep.room.name);
                if (hostiles && hostiles.length > 0) {
                    // Retreat logic could go here, for now just avoid working/moving towards them
                    // Since it's remote, we might just return early to sleep/wait or move home
                    continue;
                }
            }

            // If we are not in the target room, move towards it
            if (creep.room.name !== targetRoomName) {
                const targetPos = new RoomPosition(25, 25, targetRoomName);
                movement.moveTo(creep, targetPos);
                continue;
            }

            // We are in the target room. Bounce off the exit tile if needed.
            if (creep.pos.x === 0 || creep.pos.x === 49 || creep.pos.y === 0 || creep.pos.y === 49) {
                const centerPos = new RoomPosition(25, 25, targetRoomName);
                movement.moveTo(creep, centerPos);
                continue;
            }

            // In the target room and off the exit.
            const targetSourceId = creep.memory.targetSourceId;
            if (!targetSourceId) continue;

            const source = Game.getObjectById(targetSourceId);
            if (!source) continue;

            const containerId = creep.memory.containerId;
            let container = null;
            if (containerId) {
                container = Game.getObjectById(containerId);
            }

            // Logic to build/repair container or harvest and drop
            if (containerId) {
                if (container) {
                    // Container exists
                    if (container.hits < container.hitsMax) {
                        // Need to repair
                        if (creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                            if (creep.repair(container) === ERR_NOT_IN_RANGE) {
                                movement.moveTo(creep, container);
                            }
                            continue;
                        } else {
                            // Harvest to repair later
                            if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
                                movement.moveTo(creep, source);
                            }
                            continue;
                        }
                    } else {
                        // Container is fully repaired, harvest and drop on it or harvest directly
                        if (!creep.pos.isEqualTo(container.pos)) {
                            movement.moveTo(creep, container);
                            continue;
                        }

                        // We are in position
                        creep.harvest(source);
                    }
                } else {
                    // Container ID set but doesn't exist. Maybe it's a construction site?
                    const sites = global.State.sitesByRoom.get(creep.room.name) || [];
                    let siteFound = null;
                    for (let i = 0; i < sites.length; i++) {
                        if (sites[i].structureType === STRUCTURE_CONTAINER && sites[i].pos.isNearTo(source)) {
                            siteFound = sites[i];
                            break;
                        }
                    }

                    if (siteFound) {
                        if (creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                            if (creep.build(siteFound) === ERR_NOT_IN_RANGE) {
                                movement.moveTo(creep, siteFound);
                            }
                        } else {
                            if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
                                movement.moveTo(creep, source);
                            }
                        }
                        continue;
                    } else {
                        // No container and no site. Just harvest and drop for now.
                        if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
                            movement.moveTo(creep, source);
                        } else {
                            // Containerless mining logic: harvest and drop
                            if (creep.store.getFreeCapacity() === 0) {
                                creep.drop(RESOURCE_ENERGY);
                            }
                        }
                    }
                }
            } else {
                // No container Id. Harvest and drop.
                if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
                    movement.moveTo(creep, source);
                } else {
                    // Drop energy if full
                    if (creep.store.getFreeCapacity() === 0) {
                        creep.drop(RESOURCE_ENERGY);
                    }
                }
            }

        } catch (e) {
            console.error(\`[remoteHarvester Error] Room \${room.name}, Creep \${creep.name}: \${e.stack}\`);
        }
    }
}`;

code = code.replace(/const movement = require\('\.\.\/utils\/movement'\);\s*\/\*\*[\s\S]*\}\s*\n\s*\}/, replacement);

fs.writeFileSync('src/roles/remoteHarvester.js', code);
