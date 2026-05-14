
/* eslint-disable no-redeclare */
/* global RoomPosition, TERRAIN_MASK_WALL, STRUCTURE_ROAD, STRUCTURE_CONTAINER, STRUCTURE_LINK, STRUCTURE_RAMPART */
const roomPositionUtils = {
    /**
     * Calculates a new RoomPosition given an anchorPos and relative dx, dy offsets.
     * @param {RoomPosition|{x: number, y: number, roomName?: string}} anchorPos - The anchor position
     * @param {number} dx - The x offset
     * @param {number} dy - The y offset
     * @param {string} [roomName] - Optional roomName if anchorPos is just {x, y}
     * @returns {RoomPosition} The new RoomPosition
     */
    getAbsolutePosition: function(anchorPos, dx, dy, roomName) {
        const x = anchorPos.x + dx;
        const y = anchorPos.y + dy;
        const rn = anchorPos.roomName || roomName;
        return new RoomPosition(x, y, rn);
    },

    /**
     * Checks if a given RoomPosition is walkable (not a wall).
     * @param {string} roomName - The name of the room
     * @param {number} x - The x coordinate
     * @param {number} y - The y coordinate
     * @returns {boolean} True if walkable, false otherwise
     */
    isWalkable: function(roomName, x, y) {
        if (x < 0 || x > 49 || y < 0 || y > 49) return false;
        const terrain = global.State.roomTerrain.get(roomName);
        if (!terrain) return false;
        return terrain.get(x, y) !== TERRAIN_MASK_WALL;
    },

    /**
     * Checks if a given RoomPosition is suitable for building a specific structureType.
     * @param {string} roomName - The name of the room
     * @param {number} x - The x coordinate
     * @param {number} y - The y coordinate
     * @param {string} structureType - The type of structure to build
     * @returns {boolean} True if buildable, false otherwise
     */
    isBuildable: function(roomName, x, y, structureType) {
        if (!this.isWalkable(roomName, x, y)) {
            return false;
        }

        const structuresByType = global.State.structuresByRoom.get(roomName);
        if (structuresByType) {
            for (const structs of structuresByType.values()) {
                for (const struct of structs.values()) {
                    if (struct.pos.x === x && struct.pos.y === y) {
                        if (structureType === STRUCTURE_ROAD) {
                            if (struct.structureType !== STRUCTURE_CONTAINER && struct.structureType !== STRUCTURE_LINK && struct.structureType !== STRUCTURE_ROAD && struct.structureType !== STRUCTURE_RAMPART) {
                                return false;
                            }
                        } else if (structureType === STRUCTURE_RAMPART) {
                            // Ramparts can be built anywhere
                        } else {
                                if (struct.structureType === structureType) {
                                    // Already built structure of the planned type is okay to include
                                } else if (struct.structureType !== STRUCTURE_ROAD && struct.structureType !== STRUCTURE_RAMPART) {
                                return false;
                            }
                        }
                    }
                }
            }
        }

        const sites = global.State.sitesByRoom.get(roomName);
        if (sites) {
            for (let i = 0; i < sites.length; i++) {
                const site = sites[i];
                if (site.pos.x === x && site.pos.y === y) {
                    if (structureType === STRUCTURE_ROAD) {
                        if (site.structureType !== STRUCTURE_CONTAINER && site.structureType !== STRUCTURE_LINK && site.structureType !== STRUCTURE_ROAD && site.structureType !== STRUCTURE_RAMPART) {
                            return false;
                        }
                    } else if (structureType === STRUCTURE_RAMPART) {
                        // Ramparts can be built anywhere
                    } else {
                            if (site.structureType === structureType) {
                                // Already planned site of the planned type is okay to include
                            } else if (site.structureType !== STRUCTURE_ROAD && site.structureType !== STRUCTURE_RAMPART) {
                            return false;
                        }
                    }
                }
            }
        }

        return true;
    }
};

module.exports = roomPositionUtils;
