/**
 * Expansion Manager
 * Automates the establishment of new colonies.
 */
class ExpansionManager {
    static run() {
        // Evaluate every 100 ticks. Expansion is a slow, strategic decision.
        if (Game.time % 100 !== 0) return;
        
        // Ensure CPU safety and global State availability
        if (Game.cpu.bucket < 8000 || Game.cpu.getUsed() > Game.cpu.limit * 0.8) return;
        if (!global.State || !global.State.colonies || !Memory.rooms) return;

        // Ensure we have a colonize target or we can support one.
        if (!Memory.empire) Memory.empire = {};
        if (Memory.empire.colonizeRoom) {
            // Already expanding
            const targetRoom = Game.rooms[Memory.empire.colonizeRoom];
            if (targetRoom && targetRoom.controller && targetRoom.controller.my && targetRoom.controller.level >= 1) {
                // Expansion successful
                delete Memory.empire.colonizeRoom;
                delete Memory.empire.colonizeSourceColony;
            }
            return;
        }

        // We can only expand if we have the GCL.
        const activeColonies = global.State.colonies.size;
        if (activeColonies >= Game.gcl.level) return;

        const candidateRooms = [];

        // 1. Evaluate IntelManager data
        for (const roomName in Memory.rooms) {
            const intel = Memory.rooms[roomName];
            
            // Basic suitability
            if (intel.roomType !== 'core') continue;
            if (intel.controller && intel.controller.owner) continue;
            
            // Must have 2 sources
            if (!intel.sources || intel.sources.length < 2) continue;
            
            // Threat check
            if (intel.hostiles && (intel.hostiles.towers > 0 || intel.hostiles.invaderCore || intel.hostiles.creeps > 0)) continue;

            // Distance Check: Must be >= 3 rooms away from any existing colony
            let minDistanceToColony = Infinity;
            let closestColony = null;

            for (const colony of global.State.colonies.values()) {
                const dist = Game.map.getRoomLinearDistance(roomName, colony.name);
                if (dist < minDistanceToColony) {
                    minDistanceToColony = dist;
                    closestColony = colony.name;
                }
            }

            if (minDistanceToColony >= 3 && closestColony) {
                // Ensure the closest colony has the economy (RCL 4+) to support an expansion
                const colonyState = global.State.rooms.get(closestColony);
                if (colonyState && colonyState.controller && colonyState.controller.level >= 4) {
                    candidateRooms.push({ roomName, closestColony, minDistanceToColony });
                }
            }
        }

        // 2. Select the best candidate
        if (candidateRooms.length > 0) {
            // Sort by proximity to nearest friendly colony (closer is easier to reinforce)
            candidateRooms.sort((a, b) => a.minDistanceToColony - b.minDistanceToColony);
            
            const bestCandidate = candidateRooms[0];
            Memory.empire.colonizeRoom = bestCandidate.roomName;
            Memory.empire.colonizeSourceColony = bestCandidate.closestColony;
        }
    }
}

module.exports = ExpansionManager;
