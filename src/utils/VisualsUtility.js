/**
 * Utility module for basic in-game visuals.
 * Used for debugging and visualization purposes.
 * @module VisualsUtility
 */

/**
 * Draws a circle at the given position.
 *
 * @param {RoomPosition} pos - The position to draw the circle at.
 * @param {string} color - The color of the circle.
 * @param {Object} [opts={}] - Additional options for the circle.
 */
function drawCircle(pos, color, opts = {}) {
    if (!pos || !pos.roomName) return;
    const visual = new RoomVisual(pos.roomName);
    visual.circle(pos.x, pos.y, { fill: color, radius: 0.55, opacity: 0.3, ...opts });
}

/**
 * Draws a path (polyline) given an array of RoomPositions.
 *
 * @param {RoomPosition[]} path - The array of positions forming the path.
 * @param {string} color - The color of the path.
 * @param {Object} [opts={}] - Additional options for the polyline.
 */
function drawPath(path, color, opts = {}) {
    if (!path || !Array.isArray(path) || path.length === 0) return;

    // Group path by room
    const pathByRoom = {};
    for (const pos of path) {
        if (!pos || !pos.roomName) continue;
        if (!pathByRoom[pos.roomName]) {
            pathByRoom[pos.roomName] = [];
        }
        pathByRoom[pos.roomName].push([pos.x, pos.y]);
    }

    for (const roomName in pathByRoom) {
        const visual = new RoomVisual(roomName);
        visual.poly(pathByRoom[roomName], { stroke: color, strokeWidth: 0.15, opacity: 0.5, ...opts });
    }
}

/**
 * Draws a line between two positions.
 *
 * @param {RoomPosition} pos1 - The start position.
 * @param {RoomPosition} pos2 - The end position.
 * @param {string} color - The color of the line.
 * @param {Object} [opts={}] - Additional options for the line.
 */
function drawLine(pos1, pos2, color, opts = {}) {
    if (!pos1 || !pos2 || !pos1.roomName || !pos2.roomName) return;
    if (pos1.roomName !== pos2.roomName) return; // Cross-room lines not supported by RoomVisual
    const visual = new RoomVisual(pos1.roomName);
    visual.line(pos1.x, pos1.y, pos2.x, pos2.y, { color: color, ...opts });
}

/**
 * Draws text at the given position.
 *
 * @param {string} text - The text to draw.
 * @param {RoomPosition} pos - The position to draw the text at.
 * @param {string} color - The color of the text.
 * @param {Object} [opts={}] - Additional options for the text.
 */
function drawText(text, pos, color, opts = {}) {
    if (!pos || !pos.roomName) return;
    const visual = new RoomVisual(pos.roomName);
    visual.text(text, pos.x, pos.y, { color: color, font: 0.5, ...opts });
}

/**
 * Draws the path of a creep if it exists in heap.
 *
 * @param {Creep} creep - The creep whose path to draw.
 * @param {Object} [opts={}] - Additional options for the polyline.
 */
function drawCreepPath(creep, opts = {}) {
    if (!creep || !creep.room || !creep.heap || !creep.heap.path) return;

    try {
        let path = creep.heap.path;
        let points = [];

        if (typeof path === 'string') {
            if (typeof Room !== 'undefined' && Room.deserializePath) {
                const deserialized = Room.deserializePath(path);
                points = deserialized.map(step => [step.x, step.y]);
            }
        } else if (Array.isArray(path)) {
            points = path.map(step => [step.x, step.y]);
        }

        if (points.length > 0) {
            const visual = new RoomVisual(creep.room.name);
            visual.poly(points, { stroke: '#ffffff', strokeWidth: 0.15, opacity: 0.5, ...opts });
        }
    } catch (e) {
        // Ignore errors if data is malformed
    }
}

/**
 * Draws a line from a creep to its current target.
 *
 * @param {Creep} creep - The creep.
 * @param {Object} [opts={}] - Additional options for the line.
 */
function drawTargetIndicator(creep, opts = {}) {
    if (!creep || !creep.heap || !creep.heap.targetId) return;

    try {
        const target = Game.getObjectById(creep.heap.targetId);
        if (!target || !target.pos) return;

        drawLine(creep.pos, target.pos, '#ff0000', opts);
    } catch (e) {
        // Ignore errors if data is malformed
    }
}

module.exports = {
    drawCircle,
    drawPath,
    drawLine,
    drawText,
    drawCreepPath,
    drawTargetIndicator
};
