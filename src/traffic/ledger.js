const Ledger = {
    init() {
        if (!global.State) global.State = {};
        if (!(global.State.ledger instanceof Map)) global.State.ledger = new Map();
        if (!(global.State.intentLedger instanceof Map)) global.State.intentLedger = new Map();
    },

    clear() {
        if (global.State.ledger) global.State.ledger.clear();
        if (global.State.intentLedger) global.State.intentLedger.clear();
    },

    /**
     * @param {object} creep
     * @param {string} intentType
     * @returns {boolean}
     */
    registerIntent(creep, intentType) {
        this.init();
        if (!creep || !creep.id) return false;

        let creepIntents = global.State.intentLedger.get(creep.id);
        if (!creepIntents) {
            creepIntents = {};
        }

        let category = '';
        if (['transfer', 'withdraw', 'pickup', 'drop'].includes(intentType)) {
            category = 'transfer';
        } else if (['move'].includes(intentType)) {
            category = 'movement';
        } else if (['harvest'].includes(intentType)) {
            category = 'utility';
        }

        if (category && creepIntents[category]) {
            return false;
        }

        if (category) {
            creepIntents[category] = intentType;
            global.State.intentLedger.set(creep.id, creepIntents);
        }
        return true;
    },

    /**
     * @param {object} target
     * @param {string} resourceType
     * @returns {object}
     */
    getVirtualState(target, resourceType) {
        this.init();
        const ledger = global.State.ledger;
        if (!ledger) return { used: 0, free: 0, cap: 0 };

        if (ledger.has(target.id)) {
            const state = ledger.get(target.id);
            return { used: state.used, free: state.cap - state.used, cap: state.cap };
        }

        let used = 0;
        let cap = 0;

        if (target.store) {
            used = target.store.getUsedCapacity(resourceType) || 0;
            cap = target.store.getCapacity(resourceType) || 0;
        } else if (target.amount !== undefined) {
            used = target.amount;
            cap = target.amount; // For dropped resources, cap is amount
        } else if (target.energyCapacity !== undefined) {
            used = target.energy;
            cap = target.energyCapacity;
        } else if (target.progressTotal !== undefined) {
            used = target.progress;
            cap = target.progressTotal;
        }

        return { used, free: Math.max(0, cap - used), cap };
    },

    registerTransfer(creep, target, resourceType, amount) {
        if (!this.registerIntent(creep, 'transfer')) return ERR_BUSY;
        const ledger = global.State.ledger;
        if (!ledger) return ERR_FULL;

        const targetState = this.getVirtualState(target, resourceType);
        if (targetState.free < amount) return ERR_FULL;

        ledger.set(target.id, { used: targetState.used + amount, cap: targetState.cap });

        const creepState = this.getVirtualState(creep, resourceType);
        ledger.set(creep.id, { used: creepState.used - amount, cap: creepState.cap });

        return OK;
    },

    registerWithdraw(creep, target, resourceType, amount) {
        if (!this.registerIntent(creep, 'withdraw')) return ERR_BUSY;
        const ledger = global.State.ledger;
        if (!ledger) return ERR_NOT_ENOUGH_RESOURCES;

        const targetState = this.getVirtualState(target, resourceType);
        if (targetState.used < amount) return ERR_NOT_ENOUGH_RESOURCES;

        ledger.set(target.id, { used: targetState.used - amount, cap: targetState.cap });

        const creepState = this.getVirtualState(creep, resourceType);
        ledger.set(creep.id, { used: creepState.used + amount, cap: creepState.cap });

        return OK;
    },

    registerPickup(creep, target, resourceType, amount) {
        if (!this.registerIntent(creep, 'pickup')) return ERR_BUSY;
        const ledger = global.State.ledger;
        if (!ledger) return ERR_NOT_ENOUGH_RESOURCES;

        const targetState = this.getVirtualState(target, resourceType);
        if (targetState.used < amount) return ERR_NOT_ENOUGH_RESOURCES;

        ledger.set(target.id, { used: targetState.used - amount, cap: targetState.cap });

        const creepState = this.getVirtualState(creep, resourceType);
        ledger.set(creep.id, { used: creepState.used + amount, cap: creepState.cap });

        return OK;
    },

    registerDrop(creep, resourceType, amount) {
        if (!this.registerIntent(creep, 'drop')) return ERR_BUSY;
        const ledger = global.State.ledger;
        if (!ledger) return ERR_NOT_ENOUGH_RESOURCES;

        const creepState = this.getVirtualState(creep, resourceType);
        if (creepState.used < amount) return ERR_NOT_ENOUGH_RESOURCES;

        ledger.set(creep.id, { used: creepState.used - amount, cap: creepState.cap });

        return OK;
    },

    registerHarvest(creep, target) {
        if (!this.registerIntent(creep, 'harvest')) return ERR_BUSY;
        const ledger = global.State.ledger;
        if (!ledger) return ERR_NOT_ENOUGH_RESOURCES;

        const targetState = this.getVirtualState(target, RESOURCE_ENERGY);
        const workParts = creep.getActiveBodyparts(WORK);
        const harvestAmount = Math.min(targetState.used, workParts * 2); // 2 energy per work part

        if (harvestAmount <= 0) return ERR_NOT_ENOUGH_RESOURCES;

        ledger.set(target.id, { used: targetState.used - harvestAmount, cap: targetState.cap });

        const creepState = this.getVirtualState(creep, RESOURCE_ENERGY);
        ledger.set(creep.id, { used: creepState.used + harvestAmount, cap: creepState.cap });

        return OK;
    }
};

module.exports = Ledger;
