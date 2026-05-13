function run(room) {
    if (!room.controller || room.controller.level < 5) return;

    try {
        const structuresMap = global.State.structuresByRoom.get(room.name);
        if (!structuresMap) return;

        const links = structuresMap.get(STRUCTURE_LINK) || [];
        if (links.length < 2) return;

        // Check if any link is at capacity to bypass tick slicing
        let isAnyLinkFull = false;
        for (let i = 0; i < links.length; i++) {
            if (links[i].store.getUsedCapacity(RESOURCE_ENERGY) >= 700) {
                isAnyLinkFull = true;
                break;
            }
        }

        if (!isAnyLinkFull && Game.time % 5 !== 0) return; // Aggressive Tick Slicing unless immediate action is needed

        const storages = structuresMap.get(STRUCTURE_STORAGE) || [];
        const storage = storages.length > 0 ? storages[0] : null;

        let hubLink = null;
        let controllerLink = null;
        const sourceLinks = [];

        // Identify link types
        for (let i = 0; i < links.length; i++) {
            const link = links[i];

            // Is Hub Link?
            if (storage && link.pos.isNearTo(storage)) {
                hubLink = link;
                continue;
            }

            // Is Controller Link?
            if (link.pos.inRangeTo(room.controller, 3)) {
                controllerLink = link;
                continue;
            }

            // Otherwise, must be a source link
            sourceLinks.push(link);
        }

        // Process Source Links transferring energy
        for (let i = 0; i < sourceLinks.length; i++) {
            const sLink = sourceLinks[i];
            if (sLink.cooldown > 0) continue;

            if (sLink.store.getUsedCapacity(RESOURCE_ENERGY) >= 700) { // Nearly full or full
                let transferred = false;

                // Priority 1: Hub Link (Storage needs / Spawns)
                if (hubLink && hubLink.store.getFreeCapacity(RESOURCE_ENERGY) >= 700) {
                    sLink.transferEnergy(hubLink);
                    transferred = true;
                }

                // Priority 2: Controller Link
                if (!transferred && controllerLink && controllerLink.store.getFreeCapacity(RESOURCE_ENERGY) >= 700) {
                    sLink.transferEnergy(controllerLink);
                }
            }
        }

        // Process Hub Link transferring energy to Controller Link
        if (hubLink && hubLink.cooldown === 0 && hubLink.store.getUsedCapacity(RESOURCE_ENERGY) >= 700) {
            if (controllerLink && controllerLink.store.getFreeCapacity(RESOURCE_ENERGY) >= 700) {
                hubLink.transferEnergy(controllerLink);
            }
        }
    } catch (e) {
        console.log(`[LinkManager Error] Room ${room.name}: ${e.stack}`);
    }
}

function getControllerLink(roomName) {
    if (!global.State.linksByRoom) return null;
    const roomLinks = global.State.linksByRoom.get(roomName);
    return roomLinks ? roomLinks.controllerLink : null;
}

module.exports = { run, getControllerLink };
