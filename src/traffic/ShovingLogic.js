/**
 * Utility module for handling simultaneous swapping (shoving) of creeps.
 * Resolves traffic by identifying idle, blocking creeps in corridors
 * and determining the appropriate opposite move intents.
 * @module ShovingLogic
 */

const ShovingLogic = {
    /**
     * Processes shoving logic for a moving creep encountering a blocker.
     * Identifies blocking creeps and executes swapping if possible.
     *
     * @param {Creep} creep - The creep attempting to move.
     * @param {RoomPosition} intendedNextPos - The target position the creep wants to move to.
     * @param {Map<string, Map<number, string>>} currentPositions - Map of positions to creep names.
     * @returns {boolean} True if a swap occurred, otherwise false.
     */
    processShove(creep, intendedNextPos, currentPositions) {
        if (!intendedNextPos || !currentPositions) return false;

        const posKey = (intendedNextPos.x << 6) | intendedNextPos.y;
        const roomMap = currentPositions.get(intendedNextPos.roomName);
        const blockingCreepName = roomMap ? roomMap.get(posKey) : undefined;

        if (blockingCreepName && blockingCreepName !== creep.name) {
            const blockingLive = global.State.creepLookup ? global.State.creepLookup.get(blockingCreepName) : Game.creeps[blockingCreepName];

            if (blockingLive && blockingLive.fatigue === 0) {
                let canSwap = false;

                if (!global.State.trafficIntents.has(blockingCreepName)) {
                    // Creep B is completely idle
                    canSwap = true;
                    if (global.State.staticCreeps && global.State.staticCreeps.has(blockingCreepName)) {
                        canSwap = false;
                    }
                } else {
                    const blockingIntent = global.State.trafficIntents.get(blockingCreepName);
                    if (blockingIntent && blockingIntent.intendedNextPos &&
                        blockingIntent.intendedNextPos.x === creep.pos.x &&
                        blockingIntent.intendedNextPos.y === creep.pos.y &&
                        blockingIntent.intendedNextPos.roomName === creep.pos.roomName) {
                        // Creep B has a move intent in the EXACT OPPOSITE direction (head-on collision)
                        canSwap = true;

                        if (global.State.staticCreeps && global.State.staticCreeps.has(blockingCreepName)) {
                            canSwap = false;
                        }
                    }
                }

                if (blockingLive && blockingLive.heap && blockingLive.heap.isStatic) {
                    canSwap = false;
                }

                if (!canSwap && (blockingLive && blockingLive.heap && blockingLive.heap.isStatic || (global.State.staticCreeps && global.State.staticCreeps.has(blockingCreepName)))) {
                    creep.heap.needsDetour = true;
                    if (blockingLive) {
                        creep.heap.blockerPos = { x: blockingLive.pos.x, y: blockingLive.pos.y, roomName: blockingLive.pos.roomName };
                    } else if (intendedNextPos) {
                        creep.heap.blockerPos = { x: intendedNextPos.x, y: intendedNextPos.y, roomName: intendedNextPos.roomName };
                    }
                }

                if (canSwap) {
                    const dir = creep.pos.getDirectionTo(intendedNextPos);
                    if (dir) {
                        creep.move(dir);
                        if (!global.State.trafficIntents.has(blockingCreepName)) {
                            blockingLive.move(((dir + 3) % 8) + 1);
                        }
                    }
                    return true;
                }
            }
        }

        return false;
    }
};

module.exports = ShovingLogic;
