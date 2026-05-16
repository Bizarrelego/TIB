const MathUtils = require('../utils/math');

/**
 * Handles global market trade execution based on EMA values.
 */
class MarketManager {
    /**
     * Executes market operations per room.
     * @param {Room} room - The room object.
     */
    static run(room) {
        if (Game.cpu.bucket < 2000) return; // CPU Throttling

        if (!global.State) global.State = {};
        if (!global.State.marketOrders) global.State.marketOrders = new Map();

        // Throttle API calls to every 50 ticks
        if (Game.time % 50 === 0 || global.State.marketOrders.size === 0) {
            this.updateMarketCache();
        }

        // Execute market operations occasionally to save CPU
        if (Game.time % 10 !== 0) return;

        if (!room.terminal || room.terminal.cooldown > 0) return;

        try {
            this.executeTrades(room);
        } catch (e) {
            console.log(`[MarketManager Error] Room ${room.name}: ${e.stack}`);
        }
    }

    /**
     * Fetches all market orders and caches them globally to bypass native polling.
     */
    static updateMarketCache() {
        if (global.State.lastMarketFetch === Game.time) return; // Only once per tick globally
        global.State.lastMarketFetch = Game.time;
        global.State.marketOrders.clear();

        const orders = Game.market.getAllOrders({ type: ORDER_BUY });
        for (let i = 0; i < orders.length; i++) {
            const order = orders[i];
            if (!global.State.marketOrders.has(order.resourceType)) {
                global.State.marketOrders.set(order.resourceType, []);
            }
            global.State.marketOrders.get(order.resourceType).push(order);
        }
    }

    /**
     * Evaluates terminal inventory against market orders and performs arbitrage.
     * @param {Room} room - The room object.
     */
    static executeTrades(room) {
        const terminal = room.terminal;
        const MIN_SELL_AMOUNT = 1000;

        // Find minerals in the terminal to sell
        for (const resourceType in terminal.store) {
            if (resourceType === RESOURCE_ENERGY) continue;

            const amount = terminal.store[resourceType];
            if (amount < MIN_SELL_AMOUNT) continue;

            const orders = global.State.marketOrders.get(resourceType) || [];
            if (orders.length === 0) continue;

            const prices = orders.map(o => o.price);
            const filteredPrices = MathUtils.filterOutliersIQR(prices);

            if (filteredPrices.length === 0) continue;

            const minPrice = Math.min(...filteredPrices);
            const maxPrice = Math.max(...filteredPrices);

            const validOrders = orders.filter(o => o.price >= minPrice && o.price <= maxPrice);

            if (validOrders.length === 0) continue;

            // Calculate EMA (using a simple average of filtered prices for the current value, could be more complex based on historical data)
            const currentAvgPrice = filteredPrices.reduce((sum, price) => sum + price, 0) / filteredPrices.length;

            // In a real implementation, prevEma would be fetched from Memory/Heap.
            // For now, we will just use the current average as the baseline if we don't have history.
            if (!global.State) global.State = {};
            if (!global.State.marketEMA) global.State.marketEMA = new Map();

            const prevEma = global.State.marketEMA.get(resourceType) || currentAvgPrice;
            const ema = MathUtils.calculateEMA(currentAvgPrice, prevEma, 100);

            // Store new EMA
            global.State.marketEMA.set(resourceType, ema);

            // Sort orders by price descending
            validOrders.sort((a, b) => b.price - a.price);

            for (const order of validOrders) {
                // Sell if price is above EMA and spread is good enough to cover energy costs
                if (order.price >= ema) {
                    const spread = order.price - ema;
                    const energyCost = Game.market.calcTransactionCost(MIN_SELL_AMOUNT, room.name, order.roomName);
                    const transferCostPerUnit = energyCost / MIN_SELL_AMOUNT;

                    // Basic sanity check: Is the energy cost worth the trade?
                    // (Assuming energy is worth roughly 1 credit for this simple example, can be adjusted)
                    // Only execute trades if the spread exceeds transfer costs
                    if (spread > transferCostPerUnit && terminal.store[RESOURCE_ENERGY] >= energyCost) {
                         const amountToSell = Math.min(amount, order.remainingAmount, MIN_SELL_AMOUNT);
                         const result = Game.market.deal(order.id, amountToSell, room.name);
                         if (result === OK) {
                             console.log(`[MarketManager] Sold ${amountToSell} ${resourceType} to ${order.roomName} at price ${order.price}`);
                             break; // Only execute one deal per tick per resource
                         }
                    }
                }
            }
        }
    }
}

module.exports = MarketManager;
