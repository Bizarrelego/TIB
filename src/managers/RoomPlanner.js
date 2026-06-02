/**
 * Room Planner Manager
 * Handles automated construction site placement based on RCL progression.
 */

class RoomPlanner {
    static run() {
        const visibleRooms = Object.keys(Game.rooms);
        for (let i = 0; i < visibleRooms.length; i++) {
            const room = Game.rooms[visibleRooms[i]];
            if (room.controller && room.controller.my) {
                RoomPlanner.planRoom(room);
            }
        }
    }

    static planRoom(room) {
        const rcl = room.controller.level;
        
        // 1. Plan source containers regardless of RCL
        RoomPlanner.planSourceContainers(room);

        if (rcl < 2) return;

        const spawns = room.find(FIND_MY_SPAWNS);
        if (spawns.length === 0) return;
        const anchor = spawns[0].pos;

        // 2. Plan Extensions
        const maxExtensions = CONTROLLER_STRUCTURES[STRUCTURE_EXTENSION][rcl];
        RoomPlanner.planExtensions(room, anchor, maxExtensions);

        // 3. Plan Towers
        if (rcl >= 3) {
            const maxTowers = CONTROLLER_STRUCTURES[STRUCTURE_TOWER][rcl];
            RoomPlanner.planTowers(room, anchor, maxTowers);
        }
    }

    static planSourceContainers(room) {
        const sources = room.find(FIND_SOURCES);
        
        for (let i = 0; i < sources.length; i++) {
            const source = sources[i];
            
            const containers = source.pos.findInRange(FIND_STRUCTURES, 1, { filter: s => s.structureType === STRUCTURE_CONTAINER });
            const sites = source.pos.findInRange(FIND_CONSTRUCTION_SITES, 1, { filter: s => s.structureType === STRUCTURE_CONTAINER });
            
            if (containers.length > 0 || sites.length > 0) continue;

            // Find an open spot adjacent to the source
            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    if (dx === 0 && dy === 0) continue;
                    
                    const x = source.pos.x + dx;
                    const y = source.pos.y + dy;
                    
                    const terrain = Game.map.getRoomTerrain(room.name).get(x, y);
                    if (terrain === TERRAIN_MASK_WALL) continue;

                    const result = room.createConstructionSite(x, y, STRUCTURE_CONTAINER);
                    if (result === OK) break; // Only place one container per source
                }
                if (sites.length > 0) break;
            }
        }
    }

    static planExtensions(room, anchor, targetCount) {
        const extensions = room.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_EXTENSION } });
        const sites = room.find(FIND_MY_CONSTRUCTION_SITES, { filter: { structureType: STRUCTURE_EXTENSION } });
        
        let currentCount = extensions.length + sites.length;
        if (currentCount >= targetCount) return;

        let radius = 2;
        while (currentCount < targetCount && radius < 10) {
            for (let dx = -radius; dx <= radius; dx++) {
                for (let dy = -radius; dy <= radius; dy++) {
                    if (Math.abs(dx) + Math.abs(dy) === radius && (dx + dy) % 2 === 0) {
                        const x = anchor.x + dx;
                        const y = anchor.y + dy;
                        
                        if (x < 2 || x > 47 || y < 2 || y > 47) continue;

                        const terrain = Game.map.getRoomTerrain(room.name).get(x, y);
                        if (terrain === TERRAIN_MASK_WALL) continue;

                        const isBlocked = room.lookAt(x, y).some(l => 
                            l.type === LOOK_STRUCTURES || l.type === LOOK_CONSTRUCTION_SITES
                        );

                        if (!isBlocked) {
                            const result = room.createConstructionSite(x, y, STRUCTURE_EXTENSION);
                            if (result === OK) {
                                currentCount++;
                                if (currentCount >= targetCount) return;
                            }
                        }
                    }
                }
            }
            radius++;
        }
    }

    static planTowers(room, anchor, targetCount) {
        const towers = room.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_TOWER } });
        const sites = room.find(FIND_MY_CONSTRUCTION_SITES, { filter: { structureType: STRUCTURE_TOWER } });
        
        let currentCount = towers.length + sites.length;
        if (currentCount >= targetCount) return;

        const offsets = [ {x: 0, y: -2}, {x: 2, y: 0}, {x: 0, y: 2}, {x: -2, y: 0} ];

        for (let i = 0; i < offsets.length; i++) {
            const x = anchor.x + offsets[i].x;
            const y = anchor.y + offsets[i].y;
            
            const terrain = Game.map.getRoomTerrain(room.name).get(x, y);
            if (terrain === TERRAIN_MASK_WALL) continue;

            const isBlocked = room.lookAt(x, y).some(l => 
                l.type === LOOK_STRUCTURES || l.type === LOOK_CONSTRUCTION_SITES
            );

            if (!isBlocked) {
                const result = room.createConstructionSite(x, y, STRUCTURE_TOWER);
                if (result === OK) {
                    currentCount++;
                    if (currentCount >= targetCount) return;
                }
            }
        }
    }
}

module.exports = RoomPlanner;