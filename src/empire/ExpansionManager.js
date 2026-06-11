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
            let score = ExpansionManager.evaluateExpansion(roomName);
            if (score === undefined) continue;

            // Distance Modifiers
            if (minDistanceToColony === 3) score -= 20;
            if (minDistanceToColony >= 4) score += 20;

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
        }
    }

    static evaluateExpansion(roomName) {
        const intel = Memory.rooms[roomName];
        if (!intel || !intel.sources) return undefined;

        let value = ExpansionManager.getSwampValue(roomName);
        if (intel.sources.length > 1) {
            value += 100;
        }

        // Outpost potential
        const outpostValue = ExpansionManager.getOutpostsValue(roomName);
        if (outpostValue === undefined) return undefined;
        value += outpostValue;

        // Mineral diversity logic
        const mineralType = intel.mineral;
        if (mineralType) {
            const empireMinerals = global.State.empireMinerals || [];
            if (!empireMinerals.includes(mineralType)) {
                value += 120;
                if (mineralType === RESOURCE_CATALYST) {
                    value += 80;
                }
            }
        }

        // SK proximity mineral check
        const oneAway = OutpostManager.getNeighbors(roomName, 1);
        for (let i = 0; i < oneAway.length; i++) {
            const adj = oneAway[i];
            if (OutpostManager.isKeeperRoom(adj)) {
                const skIntel = Memory.rooms[adj];
                if (skIntel && skIntel.mineral) {
                    const skMineral = skIntel.mineral;
                    const empireMinerals = global.State.empireMinerals || [];
                    if (!empireMinerals.includes(skMineral) && skMineral !== mineralType) {
                        value += 50;
                    }
                }
            }
            if (Memory.rooms[adj] && Memory.rooms[adj].isOccupied) {
                value -= 50;
            }
        }

        const twoAway = OutpostManager.getNeighbors(roomName, 2);
        for (let i = 0; i < twoAway.length; i++) {
            const adj = twoAway[i];
            if (Memory.rooms[adj] && Memory.rooms[adj].isOccupied) {
                value -= 20;
            }
        }

        return value;
    }

    static getSwampValue(roomName) {
        const terrain = Game.map.getRoomTerrain(roomName);
        let plain = 0;
        let swamp = 0;
        
        for (let y = 0; y < 50; y++) {
            for (let x = 0; x < 50; x++) {
                const terrainType = terrain.get(x, y);
                if (terrainType & TERRAIN_MASK_SWAMP) {
                    swamp++;
                } else if (terrainType === 0) { // Plain
                    plain++;
                }
            }
        }
        
        if (swamp === 0) return 60;
        if (plain === 0) return 0;
        if (plain > swamp) return 30;
        
        return Math.max(Math.min(Math.ceil((30 * (plain / swamp)) - 30), 60), -30);
    }

    static getOutpostsValue(roomName) {
        const oneAway = OutpostManager.getNeighbors(roomName, 1);
        const twoAway = OutpostManager.getNeighbors(roomName, 2);
        
        let value = 0;
        let count = 6;
        
        let hasSK = false;
        for (let i = 0; i < oneAway.length; i++) {
            if (OutpostManager.isKeeperRoom(oneAway[i])) {
                hasSK = true;
                break;
            }
        }
        
        if (hasSK) {
            value += 100;
            count = 4;
        }
        
        const closeRooms = oneAway.concat(twoAway);
        const potOutposts = [];
        
        for (let i = 0; i < closeRooms.length; i++) {
            const r = closeRooms[i];
            const status = typeof Game.map.getRoomStatus === 'function' ? Game.map.getRoomStatus(r) : null;
            if (status && (status.status === 'closed' || status.status === 'novice' || status.status === 'respawn')) continue;
            // Simplified middle room / highway check. TIB handles Highways in IntelManager
            if (Memory.rooms[r] && Memory.rooms[r].roomType === 'highway') continue;
            potOutposts.push(r);
        }
        
        const values = [];
        for (let i = 0; i < potOutposts.length; i++) {
            const o = potOutposts[i];
            const distance = oneAway.includes(o) ? 1 : 2;
            const outpostValue = ExpansionManager.getOutpostValue(o, distance);
            if (outpostValue !== undefined) {
                values.push({ roomName: o, value: outpostValue });
            }
        }
        
        // Sort descending
        values.sort((a, b) => b.value - a.value);
        
        let c = 0;
        for (let i = 0; i < values.length; i++) {
            if (c < count) {
                value += values[i].value;
                c++;
            }
        }
        
        return value;
    }

    static getOutpostValue(outpost, distance) {
        const intel = Memory.rooms[outpost];
        if (!intel) return undefined;
        
        const sources = intel.sources ? intel.sources.length : 0;
        if (sources === 0) return 0;
        
        return Math.ceil((sources * 30) / distance);
    }
}

module.exports = ExpansionManager;
