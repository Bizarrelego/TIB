class TrafficResourceLedger {
    static get ledger() {
        if (!global.TrafficResourceLedgerMap) {
            global.TrafficResourceLedgerMap = new Map();
        }
        return global.TrafficResourceLedgerMap;
    }

    /**
     * Do NOT call clear() blindly every tick.
     * The ledger manages its own memory via TTL pruning in queryAvailable.
     */
    static clear() {
        // Obsolete. If you clear this every tick, multi-tick intents are deleted.
    }

    static registerTransfer(targetId, resourceType, amount, ttl = 15) {
        const ledger = this.ledger;
        if (!ledger.has(targetId)) {
            ledger.set(targetId, new Map());
        }

        const targetLedger = ledger.get(targetId);
        if (!targetLedger.has(resourceType)) {
            targetLedger.set(resourceType, []);
        }

        const claims = targetLedger.get(resourceType);
        claims.push({ amount: amount, expiryTick: Game.time + ttl });
    }

    static queryAvailable(targetId, resourceType) {
        let currentStored = 0;

        let target = null;
        if (typeof Game !== 'undefined' && Game.getObjectById) {
            target = Game.getObjectById(targetId);
        } else if (global.State && global.State.creepLookup) {
            target = global.State.creepLookup.get(targetId);
        }

        if (target) {
            if (target.store) {
                currentStored = target.store.getUsedCapacity(resourceType) || 0;
            } else if (target.amount !== undefined) {
                currentStored = target.amount;
            } else if (target.mineralAmount !== undefined) {
                currentStored = target.mineralAmount;
            } else if (resourceType === RESOURCE_ENERGY && target.energy !== undefined) {
                currentStored = target.energy;
            }
        }

        const ledger = this.ledger;
        let registeredDelta = 0;

        if (ledger.has(targetId)) {
            const targetLedger = ledger.get(targetId);
            let claims = targetLedger.get(resourceType) || [];

            // Garbage Collection: Prune expired intents
            claims = claims.filter(claim => claim.expiryTick > Game.time);
            targetLedger.set(resourceType, claims);

            // Sum active deltas
            for (let i = 0; i < claims.length; i++) {
                registeredDelta += claims[i].amount;
            }
        }

        return currentStored + registeredDelta;
    }
}

module.exports = TrafficResourceLedger;
