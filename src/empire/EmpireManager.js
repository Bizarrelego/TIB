/**
 * Empire Manager
 * Automates territorial expansion by dynamically linking profitable map sectors to the closest operational Colony.
 */
class EmpireManager {
    static run() {
        if (Game.time % 100 !== 0) return;
        if (!global.State || !global.State.colonies) return;

        // Reset outposts globally to recalculate optimally
        for (const colony of global.State.colonies.values()) {
            if (Memory.rooms[colony.name]) {
                Memory.rooms[colony.name].outposts = [];
            }
        }

        const validOutposts = [];

        // Find all viable remote rooms
        for (const roomName in Memory.rooms) {
            const intel = Memory.rooms[roomName];
            
            // Validate viability
            if (!intel || intel.isDeadWeight) continue;
            if (intel.controller && intel.controller.owner) continue; // Owned room
            if (intel.roomType === 'core') continue; // We own it
            
            // Validate threat level (0 threat)
            if (intel.hostiles && (intel.hostiles.towers > 0 || intel.hostiles.invaderCore)) continue;
            
            if (intel.sources && intel.sources.length > 0) {
                validOutposts.push(roomName);
            }
        }

        // Assign each outpost to the closest colony
        for (let i = 0; i < validOutposts.length; i++) {
            const outpost = validOutposts[i];
            let bestColony = null;
            let bestDist = Infinity;

            for (const colony of global.State.colonies.values()) {
                const dist = Game.map.getRoomLinearDistance(colony.name, outpost);
                // Basic range check: remote mining is generally inefficient beyond 2 rooms linear
                if (dist <= 2 && dist < bestDist) {
                    bestDist = dist;
                    bestColony = colony;
                }
            }

            if (bestColony) {
                if (!Memory.rooms[bestColony.name].outposts) {
                    Memory.rooms[bestColony.name].outposts = [];
                }
                Memory.rooms[bestColony.name].outposts.push(outpost);
                
                // Update intel with assignments for global tracking
                if (!Memory.outposts) Memory.outposts = {};
                Memory.outposts[outpost] = { 
                    sourceRoom: bestColony.name, 
                    sources: Memory.rooms[outpost].sources.length 
                };
            }
        }
    }
}

module.exports = EmpireManager;
