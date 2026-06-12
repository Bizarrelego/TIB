const ActionConstants = require('../constants/ActionConstants');

/**
 * Science Manager
 * Automates the 2+8 lab cluster to synthesize advanced compounds.
 */
class ScienceManager {
    static run() {
        if (!global.structureHeap) global.structureHeap = new Map();
        if (Game.time % 10 !== 0) return;
        if (!global.State || !global.State.colonies) return;

        // Basic Target Priority for Phase 1

        for (const colony of global.State.colonies.values()) {
            const roomState = global.State.rooms.get(colony.name);
            if (!roomState || !roomState.labs || roomState.labs.length < 3) continue;

            const blueprint = global.Cache.blueprints?.get(colony.name);
            if (!blueprint || !blueprint.supplierLabs || blueprint.supplierLabs.length < 2) continue;

            const supplierLabs = [];
            const reactorLabs = [];

            // Separate suppliers from reactors based on blueprint coordinates
            for (let i = 0; i < roomState.labs.length; i++) {
                const lab = roomState.labs[i];
                let isSupplier = false;
                for (let j = 0; j < blueprint.supplierLabs.length; j++) {
                    const sup = blueprint.supplierLabs[j];
                    if (lab.pos.x === sup.x && lab.pos.y === sup.y) {
                        supplierLabs.push(lab);
                        isSupplier = true;
                        break;
                    }
                }
                if (!isSupplier) {
                    reactorLabs.push(lab);
                }
            }

            if (supplierLabs.length < 2 || reactorLabs.length === 0) continue;

            const sup1 = supplierLabs[0];
            const sup2 = supplierLabs[1];

            // Assign global science target based on terminal contents to ensure we synthesize needed compounds
            const terminal = roomState.terminal;
            let activeReaction = null;

            if (terminal) {
                // If we have Z and K, make ZK
                if (terminal.store.getUsedCapacity(RESOURCE_ZYNTHIUM) > 1000 && terminal.store.getUsedCapacity(RESOURCE_KEANIUM) > 1000) {
                    activeReaction = { target: RESOURCE_ZYNTHIUM_KEANITE, r1: RESOURCE_ZYNTHIUM, r2: RESOURCE_KEANIUM };
                } else if (terminal.store.getUsedCapacity(RESOURCE_UTRIUM) > 1000 && terminal.store.getUsedCapacity(RESOURCE_LEMERGIUM) > 1000) {
                    activeReaction = { target: RESOURCE_UTRIUM_LEMERGITE, r1: RESOURCE_UTRIUM, r2: RESOURCE_LEMERGIUM };
                }
                // Write active reaction to memory so the hubManager knows what to load
                Memory.rooms[colony.name].scienceTarget = activeReaction;
            } else {
                Memory.rooms[colony.name].scienceTarget = null;
            }

            // Execute Reactions
            if (sup1.mineralType && sup2.mineralType && sup1.mineralAmount > 0 && sup2.mineralAmount > 0) {
                // Only react if the minerals in the suppliers are compatible with the target
                if (activeReaction && (
                    (sup1.mineralType === activeReaction.r1 && sup2.mineralType === activeReaction.r2) ||
                    (sup1.mineralType === activeReaction.r2 && sup2.mineralType === activeReaction.r1)
                )) {
                    for (let i = 0; i < reactorLabs.length; i++) {
                        const reactor = reactorLabs[i];
                        if (reactor.cooldown === 0) {
                            let heap = global.structureHeap.get(reactor.id) || {};
                            heap.actionIntent = ActionConstants.ACTION_RUN_REACTION;
                            heap.targetId = sup1.id;
                            heap.secondaryTargetId = sup2.id;
                            global.structureHeap.set(reactor.id, heap);
                        }
                    }
                }
            }
        }
    }
}

module.exports = ScienceManager;
