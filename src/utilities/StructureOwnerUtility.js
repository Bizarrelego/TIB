class StructureOwnerUtility {
    /**
     * Returns the owner's username or null if unowned.
     * @param {Structure} structure - The structure to check.
     * @returns {string|null} The username of the owner, or null.
     */
    static getStructureOwner(structure) {
        if (!structure) return null;
        if (structure.owner && structure.owner.username) {
            return structure.owner.username;
        }
        if (structure.reservation && structure.reservation.username) {
            return structure.reservation.username;
        }
        return null;
    }

    /**
     * Returns true if the structure is owned by the current player.
     * @param {Structure} structure - The structure to check.
     * @returns {boolean} True if friendly, false otherwise.
     */
    static isFriendlyStructure(structure) {
        if (!structure) return false;
        return structure.my === true;
    }

    /**
     * Returns true if the structure is owned by another player.
     * @param {Structure} structure - The structure to check.
     * @returns {boolean} True if hostile, false otherwise.
     */
    static isHostileStructure(structure) {
        if (!structure) return false;
        return !!structure.owner && !structure.my;
    }

    /**
     * Returns true if the structure is unowned or owned by a neutral player.
     * @param {Structure} structure - The structure to check.
     * @returns {boolean} True if neutral, false otherwise.
     */
    static isNeutralStructure(structure) {
        if (!structure) return false;
        return !structure.owner;
    }
}

module.exports = StructureOwnerUtility;
