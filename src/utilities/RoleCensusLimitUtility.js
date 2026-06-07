class RoleCensusLimitUtility {
    static get LIMITS() {
        return {
            harvester: 2,
            hauler: 4,
            upgrader: 3,
            builder: 1
        };
    }

    static getLimit(role) {
        return this.LIMITS[role] || 0;
    }

    static getAllLimits() {
        return this.LIMITS;
    }
}

module.exports = RoleCensusLimitUtility;
