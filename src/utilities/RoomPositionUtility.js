class RoomPositionUtility {
    /**
     * Calculates the linear range between two RoomPositions.
     * If the positions are in different rooms, returns Infinity.
     * @param {RoomPosition} pos1
     * @param {RoomPosition} pos2
     * @returns {number}
     */
    static getRangeTo(pos1, pos2) {
        if (!pos1 || !pos2) return Infinity;
        if (pos1.roomName !== pos2.roomName) return Infinity;

        return Math.max(Math.abs(pos1.x - pos2.x), Math.abs(pos1.y - pos2.y));
    }

    /**
     * Gets an array of adjacent RoomPositions (up to 8, depending on map bounds).
     * @param {RoomPosition} pos
     * @returns {RoomPosition[]}
     */
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

    /**
     * Serializes a RoomPosition into a string representation.
     * @param {RoomPosition} pos
     * @returns {string|null}
     */
    static serializePosition(pos) {
        if (!pos) return null;
        return `${pos.x}:${pos.y}:${pos.roomName}`;
    }

    /**
     * Deserializes a string representation into a RoomPosition object.
     * @param {string} str
     * @returns {RoomPosition|null}
     */
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

module.exports = RoomPositionUtility;
