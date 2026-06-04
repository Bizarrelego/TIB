class FlagUtility {
    /**
     * Finds flags that match a given name pattern.
     * @param {string} pattern - The pattern to match (e.g., 'colony_RCL1_*').
     * @returns {Flag[]} An array of matching Flag objects.
     */
    static findFlagsByPattern(pattern) {
        if (!pattern || typeof pattern !== 'string') return [];

        // Convert wildcard '*' to regex '.*'
        const regexStr = '^' + pattern.split('*').join('.*') + '$';
        const regex = new RegExp(regexStr);

        const flags = Object.values(Game.flags || {});
        return flags.filter(flag => regex.test(flag.name));
    }

    /**
     * Gets all flags located in a specific room.
     * @param {string} roomName - The name of the room.
     * @returns {Flag[]} An array of Flag objects in the specified room.
     */
    static getFlagsInRoom(roomName) {
        if (!roomName || typeof roomName !== 'string') return [];

        const flags = Object.values(Game.flags || {});
        return flags.filter(flag => flag.pos && flag.pos.roomName === roomName);
    }

    /**
     * Creates a flag at the given position.
     * @param {RoomPosition} pos - The position to place the flag.
     * @param {string} name - The name of the flag.
     * @param {number} [color] - The primary color of the flag.
     * @param {number} [secondaryColor] - The secondary color of the flag.
     * @returns {string|number} The name of the flag or an error code.
     */
    static createFlag(pos, name, color, secondaryColor) {
        if (!pos || typeof pos.createFlag !== 'function') return -10; // ERR_INVALID_ARGS
        return pos.createFlag(name, color, secondaryColor);
    }

    /**
     * Removes a flag by its name.
     * @param {string} flagName - The name of the flag to remove.
     * @returns {number|undefined} OK if successful, error code, or undefined if not found.
     */
    static removeFlag(flagName) {
        if (!flagName || typeof flagName !== 'string') return undefined;

        if (typeof Game !== 'undefined' && Game.flags) {
            const flag = Game.flags[flagName];
            if (flag && typeof flag.remove === 'function') {
                return flag.remove();
            }
        }
        return undefined;
    }
}

module.exports = FlagUtility;
