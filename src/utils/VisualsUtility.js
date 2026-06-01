/**
 * VisualsUtility
 * Strictly wraps RoomVisual. Safe read-only debugging.
 */
function drawPath(roomName, path) {
    if (!path || !path.length) return;
    const rv = new RoomVisual(roomName);

    // Map path steps to coordinate arrays if needed
    const points = path.map(p => {
        if (p.x !== undefined && p.y !== undefined) {
            return [p.x, p.y];
        }
        return null;
    }).filter(p => p !== null);

    if (points.length > 0) {
        rv.poly(points, { stroke: '#ffffff', strokeWidth: 0.15, opacity: 0.2, lineStyle: 'dashed' });
    }
}

function debugCreep(creep) {
    if (!creep || !creep.room || !creep.heap) return;

    let path = creep.heap.path;
    if (path) {
        drawPath(creep.room.name, path);
    }

    let targetId = creep.heap.targetId;
    if (!targetId) return;

    const target = Game.getObjectById(targetId);
    if (!target) return;

    creep.room.visual.line(creep.pos, target.pos, { color: '#ffaa00', opacity: 0.5, lineStyle: 'dotted' });
}

module.exports = {
    drawPath,
    debugCreep
};
