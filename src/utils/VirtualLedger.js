class VirtualLedger {
    static get ledger() {
        if (!global.VirtualLedgerMap) global.VirtualLedgerMap = new Map();
        return global.VirtualLedgerMap;
    }

    static clear() {
        this.ledger.clear();
    }

    static registerIntent(targetId, resourceType, amount) {
        if (!this.ledger.has(targetId)) {
            this.ledger.set(targetId, new Map());
        }
        const targetLedger = this.ledger.get(targetId);
        const current = targetLedger.get(resourceType) || 0;
        targetLedger.set(resourceType, current + amount);
    }

    static getClaimedAmount(targetId, resourceType) {
        if (!this.ledger.has(targetId)) return 0;
        return this.ledger.get(targetId).get(resourceType) || 0;
    }
    static claim(target, resourceType, amount) {
        const available = target.store ? target.store[resourceType] : target.amount;
        const remaining = available - this.getClaimedAmount(target.id, resourceType);

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