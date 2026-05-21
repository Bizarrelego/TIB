const ResourceTransferLedger = {
    init() {
        if (!global.State) global.State = {};
        if (!(global.State.ledger instanceof Map)) {
            global.State.ledger = new Map();
        }
    },

    /**
     * Gets the virtual sub-tick state of a target.
     * Maps to the AC's getAvailable by providing accurate available amounts per target within a tick.
     * @param {string|object} target
     * @param {string} resourceType
     * @returns {object} { used, free, cap }
     */
    getAvailable(target, resourceType) {
        this.init();

        if (typeof target === 'string') {
            const obj = Game.getObjectById(target);
            if (!obj) return { used: 0, free: 0, cap: 0 };
            target = obj;
        }

        const ledger = global.State.ledger;
        if (ledger.has(target.id)) {
            const state = ledger.get(target.id);
            return { used: state.used, free: Math.max(0, state.cap - state.used), cap: state.cap };
        }

        let used = 0;
        let cap = 0;

        if (target.store) {
            used = target.store.getUsedCapacity(resourceType) || 0;
            cap = target.store.getCapacity(resourceType) || 0;
        } else if (target.amount !== undefined) {
            used = target.amount;
            cap = target.amount;
        } else if (target.mineralAmount !== undefined) {
            used = target.mineralAmount;
            cap = target.mineralCapacity !== undefined ? target.mineralCapacity : target.mineralAmount;
        } else if (target.energyCapacity !== undefined) {
            used = target.energy;
            cap = target.energyCapacity;
        } else if (target.progressTotal !== undefined) {
            used = target.progress;
            cap = target.progressTotal;
        }

        return { used, free: Math.max(0, cap - used), cap };
    },

    /**
     * Registers a transfer between a creep and a target.
     * Maps to the AC's registerTransfer requirement, with expanded support for target and intent type.
     * @param {string} creepId
     * @param {string} resourceType
     * @param {number} amount
     * @param {string} targetId Optional.
     * @param {string} intentType 'TRANSFER', 'WITHDRAW', 'PICKUP', 'DROP', 'HARVEST'
     */
    registerTransfer(creepId, resourceType, amount, targetId = null, intentType = 'TRANSFER') {
        this.init();
        const ledger = global.State.ledger;

        const creep = Game.getObjectById(creepId);
        if (!creep) return;

        const target = targetId ? Game.getObjectById(targetId) : null;

        const creepState = this.getAvailable(creep, resourceType);
        const targetState = target ? this.getAvailable(target, resourceType) : null;

        if (intentType === 'TRANSFER') {
            ledger.set(creepId, { used: creepState.used - amount, cap: creepState.cap });
            if (target) ledger.set(targetId, { used: targetState.used + amount, cap: targetState.cap });
        } else if (intentType === 'WITHDRAW' || intentType === 'PICKUP') {
            ledger.set(creepId, { used: creepState.used + amount, cap: creepState.cap });
            if (target) ledger.set(targetId, { used: targetState.used - amount, cap: targetState.cap });
        } else if (intentType === 'DROP') {
            ledger.set(creepId, { used: creepState.used - amount, cap: creepState.cap });
        } else if (intentType === 'HARVEST') {
            ledger.set(creepId, { used: creepState.used + amount, cap: creepState.cap });
            if (target) ledger.set(targetId, { used: targetState.used - amount, cap: targetState.cap });
        }
    }
};

module.exports = ResourceTransferLedger;
