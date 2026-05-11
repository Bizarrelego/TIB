class VirtualLedger {
    constructor() {
        this.capacities = new Map();
    }

    registerIntent(targetId, resourceType, amount, isWithdraw) {
        if (!this.capacities.has(targetId)) {
            this.capacities.set(targetId, new Map());
        }

        const targetLedger = this.capacities.get(targetId);
        const currentAmount = targetLedger.get(resourceType) || 0;

        const adjustment = isWithdraw ? -amount : amount;
        targetLedger.set(resourceType, currentAmount + adjustment);
    }

    // Optional: method to get virtual capacity, if needed by other components
    getVirtualCapacity(targetId, resourceType) {
        if (!this.capacities.has(targetId)) return undefined;
        return this.capacities.get(targetId).get(resourceType);
    }
}

const instance = new VirtualLedger();

module.exports = {
    VirtualLedger: VirtualLedger,
    ledger: instance,
    run: function() {
        // Main traffic execution function stub
    }
};
