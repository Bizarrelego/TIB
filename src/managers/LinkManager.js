/**
 * Top-Down Link Manager
 * Identifies Link roles based on proximity and pushes energy to the Core/Hub Link.
 */
class LinkManager {
    static run() {
        if (!global.State || !global.State.rooms) return;

        for (const [roomName, roomState] of global.State.rooms) {
            if (!roomState.links || roomState.links.length < 2) continue;

            const room = Game.rooms[roomName];
            if (!room) continue;

            let hubLink = null;
            let controllerLink = null;
            const sourceLinks = [];

            // 1. Identify Links
            for (let i = 0; i < roomState.links.length; i++) {
                const link = roomState.links[i];
                if (!link.my) continue;

                if (roomState.storage && link.pos.inRangeTo(roomState.storage, 2)) {
                    hubLink = link;
                } else if (roomState.controller && link.pos.inRangeTo(roomState.controller, 3)) {
                    controllerLink = link;
                } else if (roomState.sources) {
                    for (let j = 0; j < roomState.sources.length; j++) {
                        if (link.pos.inRangeTo(roomState.sources[j], 2)) {
                            sourceLinks.push(link);
                            break;
                        }
                    }
                }
            }

            // 2. Push Energy from Source Links
            for (let i = 0; i < sourceLinks.length; i++) {
                const srcLink = sourceLinks[i];
                if (srcLink.store.getUsedCapacity(RESOURCE_ENERGY) >= 400 && srcLink.cooldown === 0) {
                    // Try to push to Hub Link first
                    if (hubLink && hubLink.store.getFreeCapacity(RESOURCE_ENERGY) >= srcLink.store.getUsedCapacity(RESOURCE_ENERGY)) {
                        srcLink.transferEnergy(hubLink);
                    } 
                    // Fallback to Controller Link
                    else if (controllerLink && controllerLink.store.getFreeCapacity(RESOURCE_ENERGY) >= srcLink.store.getUsedCapacity(RESOURCE_ENERGY)) {
                        srcLink.transferEnergy(controllerLink);
                    }
                }
            }

            // 3. Push Energy from Hub to Controller (if needed)
            if (hubLink && hubLink.store.getUsedCapacity(RESOURCE_ENERGY) >= 400 && hubLink.cooldown === 0) {
                if (controllerLink && controllerLink.store.getFreeCapacity(RESOURCE_ENERGY) >= 400) {
                    hubLink.transferEnergy(controllerLink);
                }
            }
        }
    }
}

module.exports = LinkManager;
