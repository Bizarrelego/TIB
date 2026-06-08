// Tier 1: RCL 1 bodies (300 energy budget)
const HARVESTER_BODY_T1 = [WORK, WORK, MOVE];
const HAULER_BODY_T1 = [CARRY, CARRY, CARRY, MOVE, MOVE, MOVE];
const UPGRADER_BODY_T1 = [WORK, WORK, CARRY, MOVE];
const BUILDER_BODY_T1 = [WORK, CARRY, CARRY, MOVE, MOVE];

// Tier 2: RCL 2+ bodies (550 energy budget)
const HARVESTER_BODY_T2 = [WORK, WORK, WORK, WORK, MOVE, MOVE];
const HAULER_BODY_T2 = [CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE];
const UPGRADER_BODY_T2 = [WORK, WORK, CARRY, MOVE, MOVE];
const BUILDER_BODY_T2 = [WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE];

// Tier 3: RCL 3+ bodies (800 energy budget)
const HARVESTER_BODY_T3 = [WORK, WORK, WORK, WORK, WORK, MOVE, MOVE, MOVE];
const HAULER_BODY_T3 = [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
const UPGRADER_BODY_T3 = [WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE];
const BUILDER_BODY_T3 = [WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE];

const CreepBodies = {
    tiers: {
        harvester: [
            { minCapacity: 800, body: HARVESTER_BODY_T3 },
            { minCapacity: 550, body: HARVESTER_BODY_T2 },
            { minCapacity: 0, body: HARVESTER_BODY_T1 }
        ],
        hauler: [
            { minCapacity: 600, body: HAULER_BODY_T3 },
            { minCapacity: 400, body: HAULER_BODY_T2 },
            { minCapacity: 0, body: HAULER_BODY_T1 }
        ],
        upgrader: [
            { minCapacity: 650, body: UPGRADER_BODY_T3 },
            { minCapacity: 400, body: UPGRADER_BODY_T2 },
            { minCapacity: 0, body: UPGRADER_BODY_T1 }
        ],
        builder: [
            { minCapacity: 700, body: BUILDER_BODY_T3 },
            { minCapacity: 450, body: BUILDER_BODY_T2 },
            { minCapacity: 0, body: BUILDER_BODY_T1 }
        ]
    },

    /**
     * Gets the best body for a role given the room's energy capacity.
     * Iterates tiers from largest to smallest, returning the first that fits.
     * @param {string} role
     * @param {number} energyCapacity
     * @returns {Array<string>}
     */
    getBody: function (role, energyCapacity) {
        const roleTiers = this.tiers[role];
        if (!roleTiers) return null;

        energyCapacity = energyCapacity || 300;

        for (let i = 0; i < roleTiers.length; i++) {
            if (energyCapacity >= roleTiers[i].minCapacity) {
                return roleTiers[i].body;
            }
        }
        return roleTiers[roleTiers.length - 1].body;
    }
};

module.exports = CreepBodies;
