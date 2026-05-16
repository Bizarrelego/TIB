/**
 * @file killboxPlanner.js
 * @description Planner for identifying optimal killbox locations (unramparted tiles surrounded by tower range).
 */

/* eslint-disable no-redeclare */
/* global STRUCTURE_TOWER, STRUCTURE_RAMPART, STRUCTURE_WALL, RoomPosition */
const roomPositionUtils = require('../utils/roomPositionUtils');

module.exports = {
    /**
     * Identifies optimal killbox locations in the room.
     * @param {Room} room - The room to plan killboxes for.
     * @returns {RoomPosition[]} Array of optimal killbox locations.
     */
    planKillboxes: function(room) {
        if (!room) return [];

        const killboxTiles = [];
        let originPos = null;

        const spawns = global.State.spawnsByRoom ? (global.State.spawnsByRoom.get(room.name) || []) : [];
        if (spawns.length > 0) {
            originPos = spawns[0].pos;
        } else if (room.controller) {
            originPos = room.controller.pos;
        }

        if (!originPos) return [];

        // Simple approach: Offset from the origin towards the center of the room.
        const targetX = originPos.x < 25 ? originPos.x + 5 : originPos.x - 5;
        const targetY = originPos.y < 25 ? originPos.y + 5 : originPos.y - 5;
        const centerPos = new RoomPosition(targetX, targetY, room.name);

        const structuresMap = (global.State.structuresByRoom ? global.State.structuresByRoom.get(room.name) : null) || new Map();
        const towers = structuresMap.get(STRUCTURE_TOWER) || [];
        const ramparts = structuresMap.get(STRUCTURE_RAMPART) || [];
        const walls = structuresMap.get(STRUCTURE_WALL) || [];

        // Check a 5x5 grid around the centerPos
        for (let dx = -2; dx <= 2; dx++) {
            for (let dy = -2; dy <= 2; dy++) {
                const x = centerPos.x + dx;
                const y = centerPos.y + dy;

                if (x < 2 || x > 47 || y < 2 || y > 47) continue;

                if (!roomPositionUtils.isWalkable(room.name, x, y)) continue;

                let hasDefensiveStructure = false;
                for (let i = 0; i < ramparts.length; i++) {
                    if (ramparts[i].pos.x === x && ramparts[i].pos.y === y) {
                        hasDefensiveStructure = true;
                        break;
                    }
                }
                if (hasDefensiveStructure) continue;

                for (let i = 0; i < walls.length; i++) {
                    if (walls[i].pos.x === x && walls[i].pos.y === y) {
                        hasDefensiveStructure = true;
                        break;
                    }
                }
                if (hasDefensiveStructure) continue;

                // Ensure it's within at least one tower's effective range (<= 20 is optimal)
                let withinTowerRange = false;
                for (let i = 0; i < towers.length; i++) {
                    const tower = towers[i];
                    const dist = Math.max(Math.abs(tower.pos.x - x), Math.abs(tower.pos.y - y));
                    if (dist <= 20) {
                        withinTowerRange = true;
                        break;
                    }
                }

                // If no towers exist yet, we still plan the killbox
                if (towers.length > 0 && !withinTowerRange) continue;

                killboxTiles.push(new RoomPosition(x, y, room.name));
            }
        }

        return killboxTiles;
    }
};
