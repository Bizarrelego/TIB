/**
 * Executes Link transfer operations and manages roles (Hub, Controller, Source).
 * @param {Room} room
 * @returns {void}
 */
function run(room) {
    if (!room.controller || room.controller.level < 5) return;

    try {
        const structuresMap = global.State.structuresByRoom.get(room.name);
        if (!structuresMap) return;

        const links = structuresMap.get(STRUCTURE_LINK) || [];
        if (links.length < 2) return;

        // Pre-compute and Cache Link Roles
        if (!global.State.linkCache) global.State.linkCache = new Map();
        let linkCache = global.State.linkCache.get(room.name);

        if (!linkCache || linkCache.count !== links.length) {
            const storages = structuresMap.get(STRUCTURE_STORAGE) || [];
            const storage = storages.length > 0 ? storages[0] : null;

            let hubLinkId = null;
            let controllerLinkId = null;
            const sourceLinkIds = [];

            for (let i = 0; i < links.length; i++) {
                const link = links[i];
                if (storage && Math.max(Math.abs(link.pos.x - storage.pos.x), Math.abs(link.pos.y - storage.pos.y)) <= 1) {
                    hubLinkId = link.id;
                    continue;
                }
                if (Math.max(Math.abs(link.pos.x - room.controller.pos.x), Math.abs(link.pos.y - room.controller.pos.y)) <= 3) {
                    controllerLinkId = link.id;
                    continue;
                }
                sourceLinkIds.push(link.id);
            }

            linkCache = { count: links.length, hubLinkId, controllerLinkId, sourceLinkIds };
            global.State.linkCache.set(room.name, linkCache);
        }

        // Check if any link is at capacity to bypass tick slicing
        let isAnyLinkFull = false;
        for (let i = 0; i < links.length; i++) {
            if (links[i].store.getUsedCapacity(RESOURCE_ENERGY) >= 700) {
                isAnyLinkFull = true;
                break;
            }
        }

        if (!isAnyLinkFull && Game.time % 5 !== 0) return; // Aggressive Tick Slicing unless immediate action is needed

        let hubLink = linkCache.hubLinkId ? Game.getObjectById(linkCache.hubLinkId) : null;
        let controllerLink = linkCache.controllerLinkId ? Game.getObjectById(linkCache.controllerLinkId) : null;
        const sourceLinks = [];
        
        for (let i = 0; i < linkCache.sourceLinkIds.length; i++) {
            const sLink = Game.getObjectById(linkCache.sourceLinkIds[i]);
            if (sLink) sourceLinks.push(sLink);
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

/**
 * Returns the primary controller link for the room from the Link cache.
 * @param {string} roomName 
 * @returns {StructureLink|null}
 */
function getControllerLink(roomName) {
    if (!global.State.linkCache) return null;
    const roomLinks = global.State.linkCache.get(roomName);
    return roomLinks && roomLinks.controllerLinkId ? Game.getObjectById(roomLinks.controllerLinkId) : null;
}

module.exports = { run, getControllerLink };
