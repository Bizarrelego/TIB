/**
 * Global Market Manager
 * Automates global market trading to liquidate excess resources and snipe profitable deals.
 */
class MarketManager {
    static run() {
        if (Game.cpu.bucket < 1000) return;
        if (!global.State || !global.State.colonies) return;

        // Every 50 ticks, snipe good deals
        if (Game.time % 50 === 0) {
            MarketManager.snipeGoodDeals();
        }

        // Every 100 ticks, manage active sell orders
        if (Game.time % 100 === 0) {
            MarketManager.manageSellOrders();
        }

        // Every 6000 ticks, clean up dead orders
        if (Game.time % 6000 === 0) {
            MarketManager.cleanUpInactiveOrders();
        }
    }

    /**
     * Retrieves the 14-day moving average price for a resource.
     * Caches the result in global to save CPU.
     */
    static getResourcePrice(resourceType) {
        if (!global.marketPrices) global.marketPrices = {};
        if (global.marketPrices[resourceType] && global.marketPrices[resourceType].tick > Game.time - 1000) {
            return global.marketPrices[resourceType].price;
        }

        const history = Game.market.getHistory(resourceType);
        if (!history || history.length === 0) return undefined;

        let totalAvg = 0;
        let days = 0;
        // Calculate average over the last 14 days
        for (let i = Math.max(0, history.length - 14); i < history.length; i++) {
            totalAvg += history[i].avgPrice;
            days++;
        }

        const price = days > 0 ? (totalAvg / days) : history[history.length - 1].avgPrice;
        global.marketPrices[resourceType] = { price, tick: Game.time };
        return price;
    }

    static snipeGoodDeals() {
        const rawMinerals = [RESOURCE_HYDROGEN, RESOURCE_OXYGEN, RESOURCE_UTRIUM, RESOURCE_LEMERGIUM, RESOURCE_KEANIUM, RESOURCE_ZYNTHIUM, RESOURCE_CATALYST];
        const resourcesToCheck = [RESOURCE_ENERGY, RESOURCE_POWER, ...rawMinerals];

        for (const colony of global.State.colonies.values()) {
            const roomState = global.State.rooms.get(colony.name);
            if (!roomState || !roomState.terminal || !roomState.terminal.my || !roomState.storage) continue;
            if (roomState.terminal.cooldown > 0) continue;

            const terminal = roomState.terminal;

            for (let i = 0; i < resourcesToCheck.length; i++) {
                const res = resourcesToCheck[i];
                let sellThreshold = 50000;
                if (res === RESOURCE_POWER) sellThreshold = 5000;
                if (res === RESOURCE_ENERGY) sellThreshold = 300000;

                const amount = terminal.store.getUsedCapacity(res);
                if (amount > sellThreshold) {
                    MarketManager.lookForGoodDeals(colony.name, res, amount);
                }
            }
        }
    }

    static lookForGoodDeals(roomName, mineral, amountAvailable) {
        let amount = Math.min(amountAvailable, 5000);
        if (mineral === RESOURCE_POWER) amount = Math.min(amountAvailable, 100);
        if (mineral === RESOURCE_ENERGY) amount = Math.min(amountAvailable, 10000);

        const orders = Game.market.getAllOrders(o => o.type === ORDER_BUY && o.resourceType === mineral && o.amount >= amount);
        if (orders.length === 0) return;

        let bestOrder = null;
        let maxProfit = -Infinity;

        for (let i = 0; i < orders.length; i++) {
            const o = orders[i];
            const cost = Game.market.calcTransactionCost(1, roomName, o.roomName);
            // Profit minus transaction cost (evaluating energy at 0.01 cr/unit for math purposes)
            const profit = o.price - (0.01 * cost);
            if (profit > maxProfit) {
                maxProfit = profit;
                bestOrder = o;
            }
        }

        const minPrice = MarketManager.getResourcePrice(mineral);
        if (minPrice === undefined) return;

        const maxPrice = minPrice * 1.5; // We consider it a good deal if it pays 1.5x average
        
        if (bestOrder) {
            const bestPrice = bestOrder.price - (0.01 * Game.market.calcTransactionCost(1, roomName, bestOrder.roomName));
            
            // Only deal if the profit is extremely lucrative, otherwise we maintain sell orders
            if (bestPrice > maxPrice) {
                const amountToSend = Math.min(bestOrder.amount, amount);
                const cost = Game.market.calcTransactionCost(amountToSend, roomName, bestOrder.roomName);
                const roomTerminal = Game.rooms[roomName]?.terminal;

                if (roomTerminal && roomTerminal.store.getUsedCapacity(RESOURCE_ENERGY) >= cost) {
                    Game.market.deal(bestOrder.id, amountToSend, roomName);
                    console.log(`[MarketManager] SNIPED DEAL: Sold ${amountToSend} ${mineral} from ${roomName} for ${bestOrder.price}. Cost: ${cost} energy.`);
                }
            }
        }
    }

    static manageSellOrders() {
        const rawMinerals = [RESOURCE_HYDROGEN, RESOURCE_OXYGEN, RESOURCE_UTRIUM, RESOURCE_LEMERGIUM, RESOURCE_KEANIUM, RESOURCE_ZYNTHIUM, RESOURCE_CATALYST];

        for (const colony of global.State.colonies.values()) {
            const roomState = global.State.rooms.get(colony.name);
            if (!roomState || !roomState.terminal || !roomState.terminal.my || !roomState.storage) continue;

            for (let i = 0; i < rawMinerals.length; i++) {
                const mineral = rawMinerals[i];
                if (roomState.terminal.store.getUsedCapacity(mineral) > 60000) {
                    MarketManager.maintainSellOrder(colony.name, mineral);
                }
            }

            if (roomState.terminal.store.getUsedCapacity(RESOURCE_ENERGY) > 150000 && roomState.storage.store.getUsedCapacity(RESOURCE_ENERGY) > 500000) {
                MarketManager.maintainSellOrder(colony.name, RESOURCE_ENERGY);
            }
        }
    }

    static maintainSellOrder(roomName, mineral) {
        const sellOrders = [];
        for (const id in Game.market.orders) {
            const o = Game.market.orders[id];
            if (o.type === ORDER_SELL && o.resourceType === mineral && o.roomName === roomName) {
                sellOrders.push(o);
            }
        }

        const sellPrice = MarketManager.getResourcePrice(mineral);
        if (sellPrice === undefined) return;

        if (sellOrders.length > 0) {
            for (let i = 0; i < sellOrders.length; i++) {
                const order = sellOrders[i];
                // Update price if we are trying to sell higher than market value (stale order) or lower than market value (losing money)
                if (order.price > sellPrice || (order.price < sellPrice && order.remainingAmount === 0)) {
                    console.log(`[MarketManager] Updating price of ${mineral} in ${roomName} to ${sellPrice} (was ${order.price})`);
                    Game.market.changeOrderPrice(order.id, sellPrice);
                }
                if (order.remainingAmount < 2000) {
                    const addAmount = 10000 - order.remainingAmount;
                    const fee = addAmount * sellPrice * 0.05; // 5% fee
                    if (Game.market.credits >= fee) {
                        console.log(`[MarketManager] Extending sell order of ${mineral} in ${roomName} by ${addAmount}`);
                        Game.market.extendOrder(order.id, addAmount);
                    }
                }
            }
        } else {
            // Create a new order
            const amount = mineral === RESOURCE_ENERGY ? 50000 : 10000;
            const fee = amount * sellPrice * 0.05;
            if (Game.market.credits >= fee) {
                console.log(`[MarketManager] Creating sell order for ${amount} ${mineral} in ${roomName} for ${sellPrice}`);
                Game.market.createOrder({ type: ORDER_SELL, resourceType: mineral, price: sellPrice, totalAmount: amount, roomName: roomName });
            }
        }
    }

    static cleanUpInactiveOrders() {
        for (const id in Game.market.orders) {
            const o = Game.market.orders[id];
            if (!o.active && o.remainingAmount === 0) {
                Game.market.cancelOrder(o.id);
            }
        }
    }
}

module.exports = MarketManager;
