const OutpostManager = require('./OutpostManager');

/**
 * Expansion Manager
 * Automates the establishment of new colonies using advanced scoring heuristics (Terrain, Minerals, Outpost Potential).
 */
class ExpansionManager {
    static run() {
        // Evaluate every 100 ticks. Expansion is a slow, strategic decision.
        if (Game.time % 100 !== 0) return;
        
        // Ensure CPU safety and global State availability
        if (Game.cpu.bucket < 8000 || Game.cpu.getUsed() > Game.cpu.limit * 0.8) return;
        if (!global.State || !global.State.colonies || !Memory.rooms) return;

        if (!Memory.empire) Memory.empire = {};

        // 1. Maintain active expansion
        if (Memory.empire.colonizeRoom) {
            const targetRoomName = Memory.empire.colonizeRoom;
            const targetRoom = Game.rooms[targetRoomName];
            
            // Check success
            if (targetRoom && targetRoom.controller && targetRoom.controller.my && targetRoom.controller.level >= 2) {
                console.log(`[ExpansionManager] Expansion successful: ${targetRoomName} reached RCL 2.`);
                delete Memory.empire.colonizeRoom;
                delete Memory.empire.colonizeSourceColony;
                delete Memory.empire.colonizeStartTime;
                return;
            }

            // Check abort timeout (20,000 ticks)
            if (Memory.empire.colonizeStartTime && Game.time > Memory.empire.colonizeStartTime + 20000) {
                console.log(`[ExpansionManager] Expansion to ${targetRoomName} failed or stalled. Aborting.`);
                Memory.rooms[targetRoomName].badExpansion = true;
                delete Memory.empire.colonizeRoom;
                delete Memory.empire.colonizeSourceColony;
                delete Memory.empire.colonizeStartTime;
                return;
            }
            return;
        }

        // We can only expand if we have the GCL.
        const activeColonies = global.State.colonies.size;
        if (activeColonies >= Game.gcl.level) return;

        let bestTarget = null;
        let bestScore = -Infinity;
        let bestSourceColony = null;

        // 2. Score potential candidate rooms
        for (const roomName in Memory.rooms) {
            const intel = Memory.rooms[roomName];
            
            // Basic viability
            if (intel.roomType !== 'core') continue;
            if (intel.controller && intel.controller.owner) continue;
            if (intel.badExpansion) continue;
            if (intel.hostiles && (intel.hostiles.towers > 0 || intel.hostiles.invaderCore || intel.hostiles.creeps > 0)) continue;

            // Must have a controller and sources
            if (!intel.sources || intel.sources.length === 0) continue;

            // Distance & Proximity Constraints
            let minDistanceToColony = Infinity;
            let closestColony = null;
            let isTooClose = false;

            for (const colony of global.State.colonies.values()) {
                const dist = Game.map.getRoomLinearDistance(roomName, colony.name);
                if (dist < minDistanceToColony) {
                    minDistanceToColony = dist;
                    closestColony = colony.name;
                }
                // Invalid if 1 or 2 rooms away (too close)
                if (dist <= 2) {
                    isTooClose = true;
                    break;
                }
            }

            if (isTooClose || !closestColony) continue;

            const sourceColonyState = global.State.rooms.get(closestColony);
            if (!sourceColonyState || !sourceColonyState.controller || sourceColonyState.controller.level < 4) continue;

            // Execute Scoring Algorithm
            let score = ExpansionManager.evaluateExpansion(roomName, minDistanceToColony);
            if (score === undefined) continue;

            if (score > bestScore) {
                bestScore = score;
                bestTarget = roomName;
                bestSourceColony = closestColony;
            }
        }

        // 3. Select the best candidate
        if (bestTarget) {
            console.log(`[ExpansionManager] Selected new colony target: ${bestTarget} (Score: ${bestScore}). Supplied by: ${bestSourceColony}`);
            Memory.empire.colonizeRoom = bestTarget;
            Memory.empire.colonizeSourceColony = bestSourceColony;
            Memory.empire.colonizeStartTime = Game.time;
            
            // Generate and cache a safe route for pioneers
            Memory.empire.colonizeRoute = ExpansionManager.calculateSafeRoute(bestSourceColony, bestTarget);
        }
    }

    /**
     * Calculates a multi-room path avoiding hostile strongholds and closed rooms.
     * Returns an array of room names representing the sequence from startRoom to endRoom.
     */
    static calculateSafeRoute(startRoom, endRoom) {
        const route = Game.map.findRoute(startRoom, endRoom, {
            routeCallback: (roomName, _fromRoomName) => {
                const status = typeof Game.map.getRoomStatus === 'function' ? Game.map.getRoomStatus(roomName) : null;
                if (status && (status.status === 'closed' || status.status === 'novice' || status.status === 'respawn')) {
                    return Infinity;
                }
                
                const intel = Memory.rooms[roomName];
                if (intel) {
                    if (intel.controller && intel.controller.owner && intel.controller.owner !== 'Bizarrelego') {
                        return 20; // High cost for enemy rooms
                    }
                    if (intel.roomType === 'center' || intel.roomType === 'keeper') {
                        return 10; // Avoid SK rooms
                    }
                }
                return 1;
            }
        });

        if (route === ERR_NO_PATH) return [];
        
        const path = [startRoom];
        for (let i = 0; i < route.length; i++) {
            path.push(route[i].room);
        }
        return path;
    }

    static evaluateExpansion(roomName, minDistanceToColony) {
        const intel = Memory.rooms[roomName];
        if (!intel || !intel.sources) return undefined;

        // Base Sources Value
        let sourcesScore = intel.sources.length * 50;

        // Mineral Value
        let mineralScore = 0;
        const mineralType = intel.mineral;
        if (mineralType) {
            const empireMinerals = global.State.empireMinerals || [];
            if (!empireMinerals.includes(mineralType)) {
                mineralScore += 120;
                if (mineralType === RESOURCE_CATALYST) {
                    mineralScore += 80;
                }
            }
        }

        // Distance Penalty
        let distanceScore = minDistanceToColony * 2;

        // Hostile Proximity Penalty
        let hostilePenalty = 0;
        const oneAway = OutpostManager.getNeighbors(roomName, 1);
        for (let i = 0; i < oneAway.length; i++) {
            const adj = oneAway[i];
            if (Memory.rooms[adj] && Memory.rooms[adj].isOccupied) {
                hostilePenalty += 50;
            }
        }

        const twoAway = OutpostManager.getNeighbors(roomName, 2);
        for (let i = 0; i < twoAway.length; i++) {
            const adj = twoAway[i];
            if (Memory.rooms[adj] && Memory.rooms[adj].isOccupied) {
                hostilePenalty += 20;
            }
        }

        return sourcesScore + mineralScore - distanceScore - hostilePenalty;
    }
}

module.exports = ExpansionManager;
