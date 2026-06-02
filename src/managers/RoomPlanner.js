/**
 * Room Planner Manager
 * Handles automated construction site placement based on RCL progression.
 * Should be run periodically (e.g., every 100 ticks) to save CPU.
 */

class RoomPlannerManager {
    static run() {
        // Run only once every 100 ticks to avoid massive CPU spikes
        if (Game.time % 100 !== 0) return;

        const visibleRooms = Object.keys(Game.rooms);
        for (let i = 0; i < visibleRooms.length; i++) {
            const room = Game.rooms[visibleRooms[i]];
            if (room.controller && room.controller.my) {
                this.planRoom(room);
            }
        }
    }

    static planRoom(room) {
        const rcl = room.controller.level;
        
        // Ensure spawn exists as an anchor point
        const spawns = room.find(FIND_MY_SPAWNS);
        if (spawns.length === 0) return;
        const anchor = spawns[0].pos;

        // Plan based on RCL
        if (rcl >= 2) {
            this.planExtensions(room, anchor, 5); // RCL 2 allows 5 extensions
        }
        if (rcl >= 3) {
            this.planExtensions(room, anchor, 10); // RCL 3 allows 10 extensions
            this.planTower(room, anchor); // RCL 3 allows 1 tower
        }
        // Add higher RCL planning here as needed
    }

    /**
     * Attempts to place extension construction sites around the anchor point.
     * Uses a simple checkerboard pattern expansion.
     */
    static planExtensions(room, anchor, targetCount) {
        const extensions = room.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_EXTENSION } });
        const sites = room.find(FIND_MY_CONSTRUCTION_SITES, { filter: { structureType: STRUCTURE_EXTENSION } });
        
        let currentCount = extensions.length + sites.length;
        if (currentCount >= targetCount) return;

        let radius = 2; // Start placing 2 tiles away from spawn
        while (currentCount < targetCount && radius < 10) { // Limit search radius
            for (let dx = -radius; dx <= radius; dx++) {
                for (let dy = -radius; dy <= radius; dy++) {
                    // Simple checkerboard pattern: only place if dx + dy is even
                    if (Math.abs(dx) + Math.abs(dy) === radius && (dx + dy) % 2 === 0) {
                        const x = anchor.x + dx;
                        const y = anchor.y + dy;
                        
                        // Bounds check
                        if (x < 2 || x > 47 || y < 2 || y > 47) continue;

                        const pos = new RoomPosition(x, y, room.name);
                        
                        // Check if the spot is buildable (terrain is not wall, no existing structures)
                        const terrain = Game.map.getRoomTerrain(room.name).get(x, y);
                        if (terrain === TERRAIN_MASK_WALL) continue;

                        const look = room.lookAt(x, y);
                        const isBlocked = look.some(l => 
                            l.type === LOOK_STRUCTURES || 
                            l.type === LOOK_CONSTRUCTION_SITES
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

    /**
     * Places a single tower near the spawn.
     */
    static planTower(room, anchor) {
        const towers = room.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_TOWER } });
        const sites = room.find(FIND_MY_CONSTRUCTION_SITES, { filter: { structureType: STRUCTURE_TOWER } });
        
        if (towers.length + sites.length >= 1) return;

        // Try to place the tower close to the spawn
        const offsets = [
            {x: 0, y: -2}, {x: 2, y: 0}, {x: 0, y: 2}, {x: -2, y: 0}
        ];

        for (let i = 0; i < offsets.length; i++) {
            const x = anchor.x + offsets[i].x;
            const y = anchor.y + offsets[i].y;
            
            const terrain = Game.map.getRoomTerrain(room.name).get(x, y);
            if (terrain === TERRAIN_MASK_WALL) continue;

            const look = room.lookAt(x, y);
            const isBlocked = look.some(l => 
                l.type === LOOK_STRUCTURES || 
                l.type === LOOK_CONSTRUCTION_SITES
            );

            if (!isBlocked) {
                const result = room.createConstructionSite(x, y, STRUCTURE_TOWER);
                if (result === OK) return;
            }
        }
    }
}

module.exports = RoomPlannerManager;