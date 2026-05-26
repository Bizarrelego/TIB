const TrafficResourceLedger = require('../traffic/TrafficResourceLedger');

class VirtualLedger {
    static get ledger() {
        return TrafficResourceLedger.ledger;
    }

    static clear() {
        // Disabled to prevent wiping multi-tick data.
        // TrafficResourceLedger.clear();
    }

    static registerIntent(targetId, resourceType, amount, ttl = 15) {
        TrafficResourceLedger.registerTransfer(targetId, resourceType, -amount, ttl);
    }

    static getClaimedAmount(targetId, resourceType) {
        if (!this.ledger.has(targetId)) return 0;

        // Force garbage collection and get current delta
        TrafficResourceLedger.queryAvailable(targetId, resourceType);

        const targetLedger = this.ledger.get(targetId);
        const claims = targetLedger.get(resourceType) || [];

        let delta = 0;
        for (let i = 0; i < claims.length; i++) {
            delta += claims[i].amount;
        }

        return delta < 0 ? Math.abs(delta) : 0;
    }

    static claim(creep, target, resourceType, amount) {
        const remaining = TrafficResourceLedger.queryAvailable(target.id, resourceType);

        // Calculate dynamic TTL: Distance + buffer for shoving/fatigue
        let distance = 10;
        if (creep && creep.pos && target.pos && creep.pos.roomName === target.pos.roomName) {
            distance = creep.pos.getRangeTo(target);
        }
        const ttl = distance + 10;

        if (remaining >= amount) {
            this.registerIntent(target.id, resourceType, amount, ttl);
            return amount;
        } else if (remaining > 0) {
            this.registerIntent(target.id, resourceType, remaining, ttl);
            return remaining;
        }
        return -1;
    }
}
module.exports = VirtualLedger;
