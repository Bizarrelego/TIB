const HarvestPositionUtility = require('./HarvestPositionUtility');
const CreepHeapUtility = require('./CreepHeapUtility');

class FixedHarvestPositionAssignmentUtility {
    /**
     * Identifies available optimal harvest positions for a given source,
     * subtracting positions already assigned to living harvesters.
     * @param {string} sourceId
     * @returns {RoomPosition[]}
     */
    static getAvailableHarvestPositions(sourceId) {
        const allPositions = HarvestPositionUtility.getAllHarvestPositions(sourceId);
        if (!allPositions || allPositions.length === 0) {
            return [];
        }

        const occupiedPositions = new Set();

        // Find all living harvesters and log their assigned positions
        const creeps = Object.values(Game.creeps);
        for (let i = 0; i < creeps.length; i++) {
            const c = creeps[i];
            if (c.memory && c.memory.role === 'harvester') {
                const assignedPos = CreepHeapUtility.getCreepHarvestPosition(c);
                if (assignedPos) {
                    // Create a unique key for the position
                    occupiedPositions.add(`${assignedPos.x},${assignedPos.y},${assignedPos.roomName}`);
                }
            }
        }

        const availablePositions = [];
        for (let i = 0; i < allPositions.length; i++) {
            const pos = allPositions[i];
            const posKey = `${pos.x},${pos.y},${pos.roomName}`;
            if (!occupiedPositions.has(posKey)) {
                availablePositions.push(pos);
            }
        }

        return availablePositions;
    }

    /**
     * Assigns an optimal harvest position to a Harvester creep.
     * @param {Creep} creep
     * @param {string} sourceId
     * @returns {boolean} True if successfully assigned, false otherwise.
     */
    static assignHarvestPosition(creep, sourceId) {
        if (!creep || !sourceId) {
            return false;
        }

        const availablePositions = this.getAvailableHarvestPositions(sourceId);
        if (availablePositions.length > 0) {
            // Assign the first available position
            CreepHeapUtility.setCreepHarvestPosition(creep, availablePositions[0]);
            return true;
        }

        return false;
    }

    /**
     * Checks if a Harvester creep is currently at its assigned harvestPosition.
     * @param {Creep} creep
     * @returns {boolean} True if at assigned position, false otherwise.
     */
    static isAtAssignedPosition(creep) {
        const assignedPos = CreepHeapUtility.getCreepHarvestPosition(creep);
        if (!assignedPos) {
            return false;
        }
        return creep.pos.x === assignedPos.x && creep.pos.y === assignedPos.y && creep.pos.roomName === assignedPos.roomName;
    }
}

module.exports = FixedHarvestPositionAssignmentUtility;
