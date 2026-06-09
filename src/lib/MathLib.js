// src/lib/MathLib.js

class MathLib {
    /**
     * Hashes a string to a positive integer using djb2 algorithm.
     * Optimized to avoid string allocations for V8.
     */
    static djb2Hash(str) {
        if (!str) return 0;
        const idString = String(str);
        let hash = 5381;
        for (let i = 0, len = idString.length; i < len; i++) {
            hash = (hash * 33) ^ idString.charCodeAt(i);
        }
        return hash >>> 0;
    }

    /**
     * Assigns a single target from a list based on a consistent hash of the creep's identifier.
     */
    static assignByHash(creepId, targetList) {
        if (!Array.isArray(targetList) || targetList.length === 0) return null;
        if (!creepId) return targetList[0];
        const hash = MathLib.djb2Hash(creepId);
        const index = hash % targetList.length;
        return targetList[index];
    }

    static getRangeTo(pos1, pos2) {
        if (!pos1 || !pos2) return Infinity;
        if (pos1.roomName !== pos2.roomName) return Infinity;
        return Math.max(Math.abs(pos1.x - pos2.x), Math.abs(pos1.y - pos2.y));
    }

    static getAdjacentPositions(pos) {
        if (!pos) return [];
        const adjacent = [];
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                if (dx === 0 && dy === 0) continue;
                const x = pos.x + dx;
                const y = pos.y + dy;
                if (x >= 0 && x <= 49 && y >= 0 && y <= 49) {
                    adjacent.push(new RoomPosition(x, y, pos.roomName));
                }
            }
        }
        return adjacent;
    }

    static serializePosition(pos) {
        if (!pos) return null;
        return `${pos.x}:${pos.y}:${pos.roomName}`;
    }

    static deserializePosition(str) {
        if (!str || typeof str !== 'string') return null;
        const parts = str.split(':');
        if (parts.length !== 3) return null;
        const x = parseInt(parts[0], 10);
        const y = parseInt(parts[1], 10);
        const roomName = parts[2];
        if (isNaN(x) || isNaN(y) || !roomName) return null;
        return new RoomPosition(x, y, roomName);
    }
}

module.exports = MathLib;
