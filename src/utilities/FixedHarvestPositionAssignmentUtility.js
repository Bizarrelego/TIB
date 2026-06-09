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

        const occupiedPositions = new Uint8Array(2500);

        // Find all living harvesters and log their assigned positions
        for (const creepName in Game.creeps) {
            const c = Game.creeps[creepName];
            if (c.memory && c.memory.role === 'harvester') {
                const assignedPos = CreepHeapUtility.getCreepHarvestPosition(c);
                if (assignedPos) {
                    occupiedPositions[assignedPos.x * 50 + assignedPos.y] = 1;
                }
            }
        }

        const availablePositions = [];
        for (let i = 0; i < allPositions.length; i++) {
            const pos = allPositions[i];
            if (!occupiedPositions[pos.x * 50 + pos.y]) {
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
