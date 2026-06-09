/**
 * Automates the RCL 5+ paradigm shift by dismantling obsolete containers 
 * and deprecating hauler quotas in favor of O(1) link networks.
 */
class InfrastructureManager {
    static run() {
        if (Game.time % 100 !== 0) return;

        if (!global.State || !global.State.rooms) return;

        for (const [roomName, roomState] of global.State.rooms) {
            const room = Game.rooms[roomName];
            if (!room || !room.controller || !room.controller.my || room.controller.level < 5) continue;

            if (!Memory.rooms) Memory.rooms = {};
            if (!Memory.rooms[roomName]) Memory.rooms[roomName] = {};
            if (!Memory.rooms[roomName].sources) Memory.rooms[roomName].sources = {};

            const sources = roomState.sources;
            if (!sources || sources.length === 0) continue;

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

                    // Find and destroy any container within range 2
                    const containers = room.find(FIND_STRUCTURES, {
                        filter: s => s.structureType === STRUCTURE_CONTAINER && s.pos.inRangeTo(source, 2)
                    });
                    
                    for (let c = 0; c < containers.length; c++) {
                        containers[c].destroy();
                    }
                } else {
                    if (Memory.rooms[roomName].sources[source.id]) {
                        Memory.rooms[roomName].sources[source.id].isLinked = false;
                    }
                }
            }
        }
    }
}

module.exports = InfrastructureManager;
