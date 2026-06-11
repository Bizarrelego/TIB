/**
 * Global Market Manager
 * Automates global market trading to liquidate excess resources and prevent terminal gridlock.
 */
class MarketManager {
    static run() {
        if (Game.time % 100 !== 0) return;
        if (!global.State || !global.State.colonies) return;

        const rawMinerals = [RESOURCE_HYDROGEN, RESOURCE_OXYGEN, RESOURCE_UTRIUM, RESOURCE_LEMERGIUM, RESOURCE_KEANIUM, RESOURCE_ZYNTHIUM, RESOURCE_CATALYST];

        for (const colony of global.State.colonies.values()) {
            const roomState = global.State.rooms.get(colony.name);
            if (!roomState || !roomState.terminal || !roomState.terminal.my) continue;

            const terminal = roomState.terminal;

            // 1. Energy Liquidation
            const energyAmount = terminal.store.getUsedCapacity(RESOURCE_ENERGY);
            if (energyAmount > 150000) {
                const sellAmount = Math.min(25000, energyAmount - 150000);
                MarketManager.liquidateResource(RESOURCE_ENERGY, sellAmount, colony.name);
            }

            // 2. Mineral Liquidation
            for (let i = 0; i < rawMinerals.length; i++) {
                const minType = rawMinerals[i];
                const amount = terminal.store.getUsedCapacity(minType);
                if (amount > 50000) {
                    const sellAmount = Math.min(10000, amount - 50000);
                    MarketManager.liquidateResource(minType, sellAmount, colony.name);
                }
            }
        }
    }

    static liquidateResource(resourceType, amount, roomName) {
        if (amount <= 0) return;

        const orders = Game.market.getAllOrders(order => order.resourceType === resourceType &&
                                                         order.type === ORDER_BUY &&
                                                         order.amount > 0);
        
        if (orders.length === 0) return;

        // Sort by highest price
        orders.sort((a, b) => b.price - a.price);
        
        const bestOrder = orders[0];
        const dealAmount = Math.min(amount, bestOrder.amount);

        // Ensure we have enough credits to pay for the transfer cost
        const cost = Game.market.calcTransactionCost(dealAmount, roomName, bestOrder.roomName);
        if (Game.rooms[roomName].terminal.store.getUsedCapacity(RESOURCE_ENERGY) < cost) {
            return; // Cannot afford transfer
        }

        Game.market.deal(bestOrder.id, dealAmount, roomName);
        console.log(`[MarketManager] Liquidated ${dealAmount} ${resourceType} from ${roomName} for ${bestOrder.price} credits each.`);
    }
}

module.exports = MarketManager;
