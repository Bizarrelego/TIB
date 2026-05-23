/**
 * @typedef {Object} ResourceLedgerEntry
 * @property {number} amount
 */

class TrafficResourceLedger {
    /**
     * @returns {Map<string, Map<string, number>>}
     */
    static get ledger() {
        if (!global.TrafficResourceLedgerMap) {
            global.TrafficResourceLedgerMap = new Map();
        }
        return global.TrafficResourceLedgerMap;
    }

    /**
     * Clears the ledger. Intended to be called at the start of a tick.
     */
    static clear() {
        this.ledger.clear();
    }

    /**
     * Registers a transfer intent.
     * @param {string} targetId The ID of the target (creep or structure).
     * @param {string} resourceType The type of resource.
     * @param {number} amount The amount to register.
     */
    static registerTransfer(targetId, resourceType, amount) {
        const ledger = this.ledger;
        if (!ledger.has(targetId)) {
            ledger.set(targetId, new Map());
        }
        const targetLedger = ledger.get(targetId);
        const currentAmount = targetLedger.get(resourceType) || 0;
        targetLedger.set(resourceType, currentAmount + amount);
    }

    /**
     * Queries the available sub-tick amount for a target.
     * @param {string} targetId The ID of the target (creep or structure).
     * @param {string} resourceType The type of resource.
     * @returns {number} The available amount considering sub-tick registered intents.
     */
    static queryAvailable(targetId, resourceType) {
        let currentStored = 0;

        // Attempt to get the actual game object
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
            registeredDelta = targetLedger.get(resourceType) || 0;
        }

        return currentStored + registeredDelta;
    }
}

module.exports = TrafficResourceLedger;
