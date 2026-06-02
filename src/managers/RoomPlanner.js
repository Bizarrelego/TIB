/**
 * Room Planner Manager
 * Handles automated construction site placement based on RCL progression.
 * Run this periodically (e.g., Game.time % 100 === 0) to avoid CPU waste.
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
        if (rcl < 2) return;

        const spawns = room.find(FIND_MY_SPAWNS);
        if (spawns.length === 0) return;
        const anchor = spawns[0].pos;

        // Dynamically grab max extensions allowed for this RCL
        const maxExtensions = CONTROLLER_STRUCTURES[STRUCTURE_EXTENSION][rcl];
        RoomPlanner.planExtensions(room, anchor, maxExtensions);

        if (rcl >= 3) {
            const maxTowers = CONTROLLER_STRUCTURES[STRUCTURE_TOWER][rcl];
            RoomPlanner.planTowers(room, anchor, maxTowers);
        }
    }

    static planExtensions(room, anchor, targetCount) {
        const extensions = room.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_EXTENSION } });
        const sites = room.find(FIND_MY_CONSTRUCTION_SITES, { filter: { structureType: STRUCTURE_EXTENSION } });
        
        let currentCount = extensions.length + sites.length;
        if (currentCount >= targetCount) return;

        let radius = 2; // Start 2 tiles away from spawn
        while (currentCount < targetCount && radius < 10) {
            for (let dx = -radius; dx <= radius; dx++) {
                for (let dy = -radius; dy <= radius; dy++) {
                    // Checkerboard pattern (dx + dy must be even)
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

        // Priority offsets for towers (close to spawn)
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