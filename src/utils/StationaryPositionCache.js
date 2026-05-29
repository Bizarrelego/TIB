/**
 * @file StationaryPositionCache.js
 * @description Utility module to calculate and cache optimal stationary positions for creeps.
 */

const RoomHasher = require('../os/roomHasher');
const roomPositionUtils = require('./roomPositionUtils');

/**
 * Utility module to calculate and cache optimal stationary positions for creeps.
 * @namespace StationaryPositionCache
 */
const StationaryPositionCache = {
    /**
     * Calculates and caches the optimal stationary position for a creep role targeting an object.
     * @param {string} roomName - The name of the room.
     * @param {string} targetId - The ID of the target object (e.g., Source, Controller).
     * @param {string} roleType - The role of the creep (e.g., 'miner', 'upgrader', 'fastFiller').
     * @returns {RoomPosition|null} The optimal RoomPosition, or null if it cannot be found.
     */
    getOptimalPosition: function(roomName, targetId, roleType) {
        if (!global.State || !global.State.stationaryPositions || !global.State.roomHashes) {
            return null;
        }

        const currentHash = RoomHasher.generate(roomName);

        // Invalidate cache if hash has changed
        if (global.State.roomHashes.get(roomName) !== currentHash) {
            global.State.stationaryPositions.set(roomName, new Map());
            global.State.roomHashes.set(roomName, currentHash);
        }

        const roomCache = global.State.stationaryPositions.get(roomName);

        // Return cached position if it exists
        if (roomCache.has(targetId)) {
            return roomCache.get(targetId);
        }

        // Calculate new position
        let position = null;
        const target = Game.getObjectById(targetId);

        if (!target) {
            return null;
        }

        const structuresMap = global.State.structuresByRoom.get(roomName);

        if (roleType === 'miner') {
            position = this._calculateMinerPosition(roomName, target, structuresMap);
        } else if (roleType === 'upgrader') {
            position = this._calculateUpgraderPosition(roomName, target, structuresMap);
        } else if (roleType === 'fastFiller') {
            position = this._calculateFastFillerPosition(roomName, target, structuresMap);
        }

        // Cache the result
        if (position) {
            roomCache.set(targetId, position);
        }

        return position;
    },

    /**
     * Calculates position for a miner (adjacent to source, preferably on a container)
     * @private
     */
    _calculateMinerPosition: function(roomName, target, structuresMap) {
        let bestPos = null;
        let foundContainerPos = null;

        const adjacentPositions = [];
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                if (dx === 0 && dy === 0) continue;
                adjacentPositions.push({ x: target.pos.x + dx, y: target.pos.y + dy });
            }
        }

        for (const pos of adjacentPositions) {
            if (roomPositionUtils.isWalkable(roomName, pos.x, pos.y)) {
                if (!bestPos) {
                    bestPos = new RoomPosition(pos.x, pos.y, roomName);
                }

                // Check for container
                if (structuresMap && structuresMap.has(STRUCTURE_CONTAINER)) {
                    const containers = structuresMap.get(STRUCTURE_CONTAINER);
                    for (const container of containers.values()) {
                        if (container.pos.x === pos.x && container.pos.y === pos.y) {
                            foundContainerPos = new RoomPosition(pos.x, pos.y, roomName);
                            break;
                        }
                    }
                }

                if (foundContainerPos) {
                    break;
                }
            }
        }

        return foundContainerPos || bestPos;
    },

    /**
     * Calculates position for an upgrader (within range 3 of controller, preferably near link/container)
     * @private
     */
    _calculateUpgraderPosition: function(roomName, target, structuresMap) {
        let bestPos = null;
        let foundContainerOrLinkPos = null;

        const range = 3;
        const positionsInRange = [];

        for (let dx = -range; dx <= range; dx++) {
            for (let dy = -range; dy <= range; dy++) {
                if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) continue; // Not adjacent to avoid blocking
                positionsInRange.push({ x: target.pos.x + dx, y: target.pos.y + dy });
            }
        }

        for (const pos of positionsInRange) {
             if (roomPositionUtils.isWalkable(roomName, pos.x, pos.y)) {
                 if (!bestPos) {
                     bestPos = new RoomPosition(pos.x, pos.y, roomName);
                 }

                 let nearContainerOrLink = false;

                 // Check if adjacent to container or link
                 for (let cdx = -1; cdx <= 1; cdx++) {
                     for (let cdy = -1; cdy <= 1; cdy++) {
                         if (cdx === 0 && cdy === 0) continue;
                         const adjX = pos.x + cdx;
                         const adjY = pos.y + cdy;

                         if (structuresMap) {
                             if (structuresMap.has(STRUCTURE_CONTAINER)) {
                                 const containers = structuresMap.get(STRUCTURE_CONTAINER);
                                 for (const container of containers.values()) {
                                      if (container.pos.x === adjX && container.pos.y === adjY) {
                                          nearContainerOrLink = true;
                                          break;
                                      }
                                 }
                             }
                             if (structuresMap.has(STRUCTURE_LINK) && !nearContainerOrLink) {
                                 const links = structuresMap.get(STRUCTURE_LINK);
                                 for (const link of links.values()) {
                                     if (link.pos.x === adjX && link.pos.y === adjY) {
                                         nearContainerOrLink = true;
                                         break;
                                     }
                                 }
                             }
                         }
                     }
                 }

                 if (nearContainerOrLink) {
                     foundContainerOrLinkPos = new RoomPosition(pos.x, pos.y, roomName);
                     break;
                 }
             }
        }

        return foundContainerOrLinkPos || bestPos;
    },

    /**
     * Calculates position for a fast filler (adjacent to spawns/extensions and storage/link)
     * @private
     */
    _calculateFastFillerPosition: function(roomName, target, structuresMap) {
        // Just return the target's position or a walkable neighbor for now.
        // Fast filler logic is complex and dependent on base layout, but we need a default.
        const adjacentPositions = [];
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                if (dx === 0 && dy === 0) continue;
                adjacentPositions.push({ x: target.pos.x + dx, y: target.pos.y + dy });
            }
        }

        for (const pos of adjacentPositions) {
            if (roomPositionUtils.isWalkable(roomName, pos.x, pos.y)) {
                return new RoomPosition(pos.x, pos.y, roomName);
            }
        }

        return null;
    }
};

module.exports = StationaryPositionCache;
