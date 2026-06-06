class RoleCensusLimitUtility {
    static get LIMITS() {
        return {
            harvester: 3,
            hauler: 3,
            upgrader: 2,
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
