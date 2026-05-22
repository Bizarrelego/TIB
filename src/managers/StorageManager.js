function run(room) {
    try {
        if (!room.controller || room.controller.level < 4) return;

        const structuresMap = global.State.structuresByRoom.get(room.name);
        const sitesMap = global.State.sitesByRoom.get(room.name);
        const sites = sitesMap ? (sitesMap instanceof Map ? Array.from(sitesMap.values()) : sitesMap) : [];

        const storageStructuresMap = structuresMap ? structuresMap.get(STRUCTURE_STORAGE) : null;
        const storageStructures = storageStructuresMap ? Array.from(storageStructuresMap.values()) : [];

        let hasStorageSite = false;
        for (let i = 0; i < sites.length; i++) {
            if (sites[i].structureType === STRUCTURE_STORAGE) {
                hasStorageSite = true;
                break;
            }
        }

        // Construction logic
        if (storageStructures.length === 0 && !hasStorageSite) {
            // Respect Single-Site Construction rule
            if (sites.length === 0) {
                const spawnsMap = global.State.spawnsByRoom.get(room.name);
                const spawns = spawnsMap ? Array.from(spawnsMap.values()) : [];
                if (spawns && spawns.length > 0) {
                    const spawn = spawns[0];
                    const targetX = spawn.pos.x;
                    const targetY = spawn.pos.y - 1; // Hardcoded offset (x + 0, y - 1)

                    let isBlocked = false;
                    if (structuresMap) {
                        for (const structs of structuresMap.values()) {
                            for (let i = 0; i < structs.length; i++) {
                                const struct = structs[i];
                                if (struct.pos.x === targetX && struct.pos.y === targetY) {
                                    if (struct.structureType !== STRUCTURE_ROAD && struct.structureType !== STRUCTURE_RAMPART) {
                                        isBlocked = true;
                                        break;
                                    }
                                }
                            }
                            if (isBlocked) break;
                        }
                    }

                    if (!isBlocked) {
                        room.createConstructionSite(targetX, targetY, STRUCTURE_STORAGE);
                    }
                }
            }
        }

    } catch (e) {
        console.log(`[StorageManager Error] Room ${room.name}: ${e.stack}`);
    }
}

module.exports = { run };
