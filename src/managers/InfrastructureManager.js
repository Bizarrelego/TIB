/**
 * Automates the RCL 5+ paradigm shift by dismantling obsolete containers 
 * and deprecating hauler quotas in favor of O(1) link networks.
 * Also automates RCL 4 Base Relocations to correct early-game spawn misplacements.
 */
class InfrastructureManager {
    static run() {
        if (Game.time % 100 !== 0) return;

        if (!global.State || !global.State.rooms) return;

        for (const [roomName, roomState] of global.State.rooms) {
            const room = Game.rooms[roomName];
            if (!room || !room.controller || !room.controller.my) continue;

            if (room.controller.level >= 4) {
                InfrastructureManager.manageSpawnRelocation(room, roomState);
            }

            if (room.controller.level >= 5) {
                InfrastructureManager.manageLinkTransition(room, roomState, roomName);
            }
        }
    }

    static manageSpawnRelocation(room, roomState) {
        if (!roomState.storage || roomState.storage.store.getUsedCapacity(RESOURCE_ENERGY) < 25000) return;
        
        const spawns = roomState.spawns || [];
        if (spawns.length !== 1) return; // Only do this if there's exactly 1 spawn

        const blueprint = global.Cache?.blueprints?.get(room.name);
        if (!blueprint || !blueprint[STRUCTURE_SPAWN] || blueprint[STRUCTURE_SPAWN].length === 0) return;

        const spawn = spawns[0];
        let isCorrectlyPlaced = false;
        
        for (let i = 0; i < blueprint[STRUCTURE_SPAWN].length; i++) {
            const plannedPos = blueprint[STRUCTURE_SPAWN][i];
            if (spawn.pos.x === plannedPos.x && spawn.pos.y === plannedPos.y) {
                isCorrectlyPlaced = true;
                break;
            }
        }

        if (!isCorrectlyPlaced) {
            const censusData = global.Cache?.tickCensus?.get(room.name);
            const builderCount = censusData && censusData.currentCensus ? (censusData.currentCensus['builder'] || 0) : 0;
            
            if (builderCount >= 2) {
                console.log(`[InfrastructureManager] Initiating RCL 4 Base Jump in ${room.name}. Destroying misplaced spawn to rebuild at blueprint anchor!`);
                spawn.destroy();
                
                // Prevent downstream crashes
                if (roomState.spawns) {
                    const idx = roomState.spawns.indexOf(spawn);
                    if (idx > -1) {
                        roomState.spawns.splice(idx, 1);
                        roomState.spawnCount--;
                    }
                }
            }
        }
    }

    static manageLinkTransition(room, roomState, roomName) {
        if (!Memory.rooms) Memory.rooms = {};
        if (!Memory.rooms[roomName]) Memory.rooms[roomName] = {};
        if (!Memory.rooms[roomName].sources) Memory.rooms[roomName].sources = {};

        const sources = roomState.sources;
        if (!sources || sources.length === 0) return;

        for (let i = 0; i < sources.length; i++) {
            const source = sources[i];
            let hasLink = false;

            if (roomState.links) {
                for (let j = 0; j < roomState.links.length; j++) {
                    const link = roomState.links[j];
                    if (link.my && link.pos.inRangeTo(source, 2)) {
                        hasLink = true;
                        break;
                    }
                }
            }

            if (hasLink) {
                Memory.rooms[roomName].sources[source.id] = { isLinked: true };

                if (roomState.containers) {
                    for (let c = roomState.containerCount - 1; c >= 0; c--) {
                        const container = roomState.containers[c];
                        if (Math.max(Math.abs(container.pos.x - source.pos.x), Math.abs(container.pos.y - source.pos.y)) <= 2) {
                            container.destroy();
                            
                            // Prevent downstream crashes
                            roomState.containers.splice(c, 1);
                            roomState.containerCount--;
                            
                            if (roomState.repairTargets) {
                                const rtIdx = roomState.repairTargets.indexOf(container);
                                if (rtIdx > -1) {
                                    roomState.repairTargets.splice(rtIdx, 1);
                                    roomState.repairTargetCount--;
                                }
                            }
                        }
                    }
                }
            } else {
                if (Memory.rooms[roomName].sources[source.id]) {
                    Memory.rooms[roomName].sources[source.id].isLinked = false;
                }
            }
        }
    }
}

module.exports = InfrastructureManager;
