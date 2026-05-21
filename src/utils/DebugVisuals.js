/**
 * @file DebugVisuals.js
 * @description Utility module for drawing arbitrary debug information on the game screen.
 */

class DebugVisuals {
    /**
     * Draws a line between two positions.
     * @param {RoomPosition|{x: number, y: number, roomName?: string}} pos1 - The start position.
     * @param {RoomPosition|{x: number, y: number, roomName?: string}} pos2 - The end position.
     * @param {Object} [style] - The style for the line.
     * @returns {typeof DebugVisuals} Returns this class for chaining.
     */
    static drawLine(pos1, pos2, style) {
        const roomName = pos1.roomName || pos2.roomName;
        new RoomVisual(roomName).line(pos1.x, pos1.y, pos2.x, pos2.y, style);
        return this;
    }

    /**
     * Displays text at a given position.
     * @param {RoomPosition|{x: number, y: number, roomName?: string}} pos - The position to display text.
     * @param {string} text - The text to display.
     * @param {Object} [style] - The style for the text.
     * @returns {typeof DebugVisuals} Returns this class for chaining.
     */
    static drawText(pos, text, style) {
        new RoomVisual(pos.roomName).text(text, pos.x, pos.y, style);
        return this;
    }

    /**
     * Draws a circle at a given position.
     * @param {RoomPosition|{x: number, y: number, roomName?: string}} pos - The position to draw the circle.
     * @param {Object} [style] - The style for the circle.
     * @returns {typeof DebugVisuals} Returns this class for chaining.
     */
    static drawCircle(pos, style) {
        new RoomVisual(pos.roomName).circle(pos.x, pos.y, style);
        return this;
    }

    /**
     * Draws a rectangle at a given position.
     * @param {RoomPosition|{x: number, y: number, roomName?: string}} pos - The top-left position of the rectangle.
     * @param {number} width - The width of the rectangle.
     * @param {number} height - The height of the rectangle.
     * @param {Object} [style] - The style for the rectangle.
     * @returns {typeof DebugVisuals} Returns this class for chaining.
     */
    static drawRect(pos, width, height, style) {
        new RoomVisual(pos.roomName).rect(pos.x, pos.y, width, height, style);
        return this;
    }

    /**
     * Draws a polygon given an array of points.
     * @param {Array<RoomPosition|{x: number, y: number, roomName?: string}|[number, number]>} points - An array of points.
     * @param {Object} [style] - The style for the polygon.
     * @returns {typeof DebugVisuals} Returns this class for chaining.
     */
    static drawPoly(points, style) {
        if (!points || points.length === 0) return this;

        let roomName;
        for (const p of points) {
            if (p.roomName) {
                roomName = p.roomName;
                break;
            }
        }

        const mappedPoints = points.map(p => {
            if (p.x !== undefined && p.y !== undefined) {
                return [p.x, p.y];
            }
            return p;
        });

        new RoomVisual(roomName).poly(mappedPoints, style);
        return this;
    }
}

module.exports = DebugVisuals;
