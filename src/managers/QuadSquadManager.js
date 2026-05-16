const Profiler = require('../utils/profiler');
const CombatManager = require('./CombatManager');
const movement = require('../utils/movement');
const TrafficManager = require('../traffic/trafficManager');

/**
 * @file QuadSquadManager.js
 * @description Manages atomic quad squad movements, formations, rotations, and synchronized attacks.
 */

class QuadSquadManager {
    /**
     * Executes logic for QuadSquadManager per room.
     * Processes defined quads in global.State.activeQuads.
     * @param {Room} room
     */
    static run(room) {
        if (!global.State || !global.State.activeQuads) return;

        for (const [, quad] of global.State.activeQuads.entries()) {
            if (!quad.creeps || quad.creeps.length === 0) continue;

            // Ensure this quad operates in this room (check leader)
            if (quad.creeps[0].room.name !== room.name) continue;

            let didRotate = false;
            if (quad.needsRotation) {
                didRotate = this.rotateQuad(quad, true);
                quad.needsRotation = false; // Reset after processing
            }

            // Allow movement and attacks even if rotation happened or was attempted
            if (quad.target && !didRotate) {
                // If it's a room position, move to it. If it's an object, move to it.
                // We only atomicQuadMove if we are not rotating this tick (to avoid intent conflicts)
                let targetPos = quad.target.pos || quad.target;
                movement.atomicQuadMove(quad.creeps, targetPos);
            } else if (quad.direction && !didRotate) {
                movement.atomicQuadMove(quad.creeps, quad.direction);
            }

            // Attacking can happen even while rotating
            if (quad.action === 'attack' && quad.target) {
                CombatManager.synchronizedBurst(quad.creeps, quad.target);
            }
        }
    }

    /**
     * Rotates the creeps in a 2x2 quad formation.
     * Uses TrafficManager.registerMove to request position swaps.
     * @param {Object} quad - The quad object containing creeps array.
     * @param {boolean} clockwise - Direction of rotation.
     * @returns {boolean} True if rotation was successfully initiated
     */
    static rotateQuad(quad, clockwise = true) {
        if (!quad.creeps || quad.creeps.length !== 4) return false;

        // Sort creeps by position to determine top-left, top-right, etc.
        // Assuming tight 2x2 formation.
        const creeps = [...quad.creeps].sort((a, b) => {
            if (a.pos.y === b.pos.y) return a.pos.x - b.pos.x;
            return a.pos.y - b.pos.y;
        });

        const topLeft = creeps[0];
        const topRight = creeps[1];
        const bottomLeft = creeps[2];
        const bottomRight = creeps[3];

        // Sanity check: ensure they form a 2x2 square
        if (!topLeft || !topRight || !bottomLeft || !bottomRight) return false;

        if (topLeft.pos.x + 1 !== topRight.pos.x || topLeft.pos.y !== topRight.pos.y ||
            topLeft.pos.x !== bottomLeft.pos.x || topLeft.pos.y + 1 !== bottomLeft.pos.y ||
            topLeft.pos.x + 1 !== bottomRight.pos.x || topLeft.pos.y + 1 !== bottomRight.pos.y) {
            // Not in tight formation, can't rotate cleanly yet
            return false;
        }

        if (clockwise) {
            // TopLeft -> TopRight (RIGHT)
            TrafficManager.registerMove(topLeft, RIGHT);
            // TopRight -> BottomRight (BOTTOM)
            TrafficManager.registerMove(topRight, BOTTOM);
            // BottomRight -> BottomLeft (LEFT)
            TrafficManager.registerMove(bottomRight, LEFT);
            // BottomLeft -> TopLeft (TOP)
            TrafficManager.registerMove(bottomLeft, TOP);

            // Re-order quad.creeps to reflect the new state so leader isn't permanently damaged at index 0
            quad.creeps = [bottomLeft, topLeft, bottomRight, topRight];
        } else {
            // TopLeft -> BottomLeft (BOTTOM)
            TrafficManager.registerMove(topLeft, BOTTOM);
            // BottomLeft -> BottomRight (RIGHT)
            TrafficManager.registerMove(bottomLeft, RIGHT);
            // BottomRight -> TopRight (TOP)
            TrafficManager.registerMove(bottomRight, TOP);
            // TopRight -> TopLeft (LEFT)
            TrafficManager.registerMove(topRight, LEFT);

            // Re-order quad.creeps
            quad.creeps = [topRight, bottomRight, topLeft, bottomLeft];
        }

        return true;
    }
}

for (const method of Object.getOwnPropertyNames(QuadSquadManager)) {
    if (typeof QuadSquadManager[method] === 'function' && method !== 'constructor' && method !== 'prototype' && method !== 'name' && method !== 'length') {
        QuadSquadManager[method] = Profiler.wrap(`QuadSquadManager.${method}`, QuadSquadManager[method]);
    }
}

module.exports = QuadSquadManager;
