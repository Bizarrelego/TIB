
const RoomPlanner = require('../managers/RoomPlanner');

/**
 * Outpost Manager
 * Brain module that evaluates, acquires, maintains, and drops outposts for each Colony.
 * Implements V8 Optimization Laws: No dynamic array creation inside tight loops, strictly in-place modifications where applicable.
 */
class OutpostManager {
    static run() {
        // Run every 50 ticks to evaluate outposts
        if (Game.time % 50 !== 0) return;
        if (!global.State || !global.State.colonies) return;

        for (const colony of global.State.colonies.values()) {
            OutpostManager.evaluateColonyOutposts(colony);
        }
    }

    static evaluateColonyOutposts(colony) {
        const roomName = colony.name;
        const coreState = global.State.rooms.get(roomName);
        if (!coreState || !coreState.controller) return;

        const rcl = coreState.controller.level;
        let maxOutposts = 0;

        // Hardcap outposts based on RCL
        if (rcl >= 8) maxOutposts = 6;
        else if (rcl >= 6) maxOutposts = 4;
        else if (rcl === 5) maxOutposts = 3;
        else if (rcl === 4) maxOutposts = 2;
        else if (rcl === 3) maxOutposts = 1;

        if (maxOutposts === 0) return;

        if (!Memory.rooms[roomName].outposts) {
            Memory.rooms[roomName].outposts = [];
        }

        const outposts = Memory.rooms[roomName].outposts;
        let updated = false;

        // 1. Maintenance: Check if we need to drop any current outposts
        for (let i = outposts.length - 1; i >= 0; i--) {
            const o = outposts[i];
            const intel = Memory.rooms[o];
            
            let drop = false;
            if (!intel) drop = true;
            else if (intel.isDeadWeight) drop = true; // Flagged by RemoteMiningManager (Pathfinder unprofitable)
            else if (intel.controller && intel.controller.owner) drop = true; // Owned by another player
            else if (intel.isOccupied) drop = true; // Occupied heavily
            else if (intel.undefendable && intel.undefendable > Game.time) drop = true; // Too heavily camped
            
            if (drop) {
                outposts.splice(i, 1);
                updated = true;
            }
        }

        // 2. Acquisition: If we are below the limit, score and claim new outposts
        if (outposts.length < maxOutposts) {
            const newOutpost = OutpostManager.getNextBestOutpost(roomName);
            if (newOutpost) {
                outposts.push(newOutpost);
                updated = true;
                if (!Memory.outposts) Memory.outposts = {};
                Memory.outposts[newOutpost] = { sourceRoom: roomName };
                RoomPlanner.planOutpost(roomName, newOutpost);
            }
        }

        // Update colony outposts array directly to prevent waiting for GlobalStateScanner sync
        if (updated) {
            colony.outposts.length = 0;
            for (let i = 0; i < outposts.length; i++) {
                colony.outposts[i] = outposts[i];
            }
        }
    }

    static getNextBestOutpost(homeRoom) {
        // Collect 1 and 2 step neighbors
        const neighbors = OutpostManager.getNeighbors(homeRoom, 2);
        
        let bestRoom = null;
        let bestScore = -Infinity;

        // Check globally claimed outposts so we don't steal from another colony
        const allOutpostsTaken = [];
        for (const colony of global.State.colonies.values()) {
            const outposts = Memory.rooms[colony.name]?.outposts;
            if (outposts) {
                for (let i = 0; i < outposts.length; i++) {
                    allOutpostsTaken.push(outposts[i]);
                }
            }
        }

        for (let i = 0; i < neighbors.length; i++) {
            const roomName = neighbors[i];
            if (allOutpostsTaken.includes(roomName)) continue;

            const intel = Memory.rooms[roomName];
            if (!intel || intel.isDeadWeight || !intel.sources || intel.sources.length === 0) continue;
            if (intel.controller && intel.controller.owner) continue;
            if (intel.isOccupied) continue;
            if (intel.undefendable && intel.undefendable > Game.time) continue;

            // Score calculation
            let score = 1000;
            if (intel.sources.length > 1) score = 1500;
            
            // Subtract linear distance cost as a heuristic backup. 
            // Real absolute profitability is verified via PathFinder by RemoteMiningManager after acquisition.
            const linearDist = Game.map.getRoomLinearDistance(homeRoom, roomName);
            score -= (linearDist * 200);

            if (score > bestScore) {
                bestScore = score;
                bestRoom = roomName;
            }
        }

        return bestRoom;
    }

    static getNeighbors(centerRoom, maxDepth) {
        const visited = [];
        const queue = [{ room: centerRoom, depth: 0 }];
        visited.push(centerRoom);

        let head = 0;
        while (head < queue.length) {
            const current = queue[head++];
            if (current.depth >= maxDepth) continue;

            const exits = Game.map.describeExits(current.room);
            if (!exits) continue;

            for (const dir in exits) {
                const adj = exits[dir];
                // Check if valid room
                const status = typeof Game.map.getRoomStatus === 'function' ? Game.map.getRoomStatus(adj) : null;
                if (status && (status.status === 'closed' || status.status === 'novice' || status.status === 'respawn')) {
                    continue;
                }

                // Check SK room
                if (OutpostManager.isKeeperRoom(adj)) continue;

                if (!visited.includes(adj)) {
                    visited.push(adj);
                    queue.push({ room: adj, depth: current.depth + 1 });
                }
            }
        }

        // Remove the center room
        visited.shift();
        return visited;
    }

    static isKeeperRoom(roomName) {
        const parsed = /^[WE]([0-9]+)[NS]([0-9]+)$/.exec(roomName);
        if (!parsed) return false;
        const x = parseInt(parsed[1]) % 10;
        const y = parseInt(parsed[2]) % 10;
        // Rooms ending in 4, 5, or 6 in both X and Y are SK rooms or the Sector Center
        return (x >= 4 && x <= 6) && (y >= 4 && y <= 6);
    }
}

module.exports = OutpostManager;
