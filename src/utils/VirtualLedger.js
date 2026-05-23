const TrafficResourceLedger = require('../traffic/TrafficResourceLedger');

class VirtualLedger {
    static get ledger() {
        return TrafficResourceLedger.ledger;
    }

    static clear() {
        TrafficResourceLedger.clear();
    }

    static registerIntent(targetId, resourceType, amount) {
        // VirtualLedger used to register positive amounts for what was claimed/intended to be withdrawn.
        // TrafficResourceLedger tracks the sub-tick inventory, so a withdrawal intent should be a negative delta.
        TrafficResourceLedger.registerTransfer(targetId, resourceType, -amount);
    }

    static getClaimedAmount(targetId, resourceType) {
        // VirtualLedger used to return a positive amount for claims.
        // Since we registered it as negative in TrafficResourceLedger, we return the absolute value of negative deltas
        // (representing how much has been claimed/removed) or 0 if it's positive (meaning stuff was added).
        if (!this.ledger.has(targetId)) return 0;
        const delta = this.ledger.get(targetId).get(resourceType) || 0;
        return delta < 0 ? Math.abs(delta) : 0;
    }

    static claim(target, resourceType, amount) {
        // queryAvailable returns the true available amount considering all deltas (including what was already claimed)
        const remaining = TrafficResourceLedger.queryAvailable(target.id, resourceType);

        if (remaining >= amount) {
            this.registerIntent(target.id, resourceType, amount);
            return amount;
        } else if (remaining > 0) {
            this.registerIntent(target.id, resourceType, remaining);
            return remaining;
        }
        return -1;
    }
}
module.exports = VirtualLedger;