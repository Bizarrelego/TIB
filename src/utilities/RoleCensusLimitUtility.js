/**
 * RCL-aware census limits for aggressive early-game progression.
 * Returns hardcoded integer limits per AGENTS.md — no dynamic math.
 */
class RoleCensusLimitUtility {
    /**
     * Census tables indexed by RCL.
     * RCL 1: Lean bootstrap — no builders (nothing to build yet), 1 upgrader to push RCL.
     * RCL 2: Builders spawn to build extensions from blueprint.
     * RCL 3: Max haulers + upgraders for aggressive RCL push.
     * RCL 4+: Fewer builders (maintenance), more upgraders.
     */
    static get CENSUS_BY_RCL() {
        return {
            1: { harvester: 2, hauler: 2, upgrader: 1, builder: 0 },
            2: { harvester: 2, hauler: 3, upgrader: 2, builder: 2 },
            3: { harvester: 2, hauler: 4, upgrader: 3, builder: 2 },
            4: { harvester: 2, hauler: 4, upgrader: 4, builder: 1 },
            5: { harvester: 2, hauler: 4, upgrader: 4, builder: 1 },
            6: { harvester: 2, hauler: 4, upgrader: 4, builder: 1 },
            7: { harvester: 2, hauler: 4, upgrader: 4, builder: 1 },
            8: { harvester: 2, hauler: 3, upgrader: 1, builder: 1 }
        };
    }

    static getLimit(role, rcl) {
        const limits = this.CENSUS_BY_RCL[rcl] || this.CENSUS_BY_RCL[4];
        return limits[role] || 0;
    }

    static getAllLimits(rcl) {
        return this.CENSUS_BY_RCL[rcl] || this.CENSUS_BY_RCL[4];
    }
}

module.exports = RoleCensusLimitUtility;
