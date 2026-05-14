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

            const orders = Game.market.getAllOrders({ type: ORDER_BUY, resourceType: resourceType });
            if (orders.length === 0) continue;

            const prices = orders.map(o => o.price);
            const filteredPrices = MathUtils.filterOutliersIQR(prices);

            if (filteredPrices.length === 0) continue;

            // Calculate EMA (using a simple average of filtered prices for the current value, could be more complex based on historical data)
            const currentAvgPrice = filteredPrices.reduce((sum, price) => sum + price, 0) / filteredPrices.length;

            // In a real implementation, prevEma would be fetched from Memory/Heap.
            // For now, we will just use the current average as the baseline if we don't have history.
            if (!global.State) global.State = {};
            if (!global.State.marketEMA) global.State.marketEMA = {};

            const prevEma = global.State.marketEMA[resourceType] || currentAvgPrice;
            const ema = MathUtils.calculateEMA(currentAvgPrice, prevEma, 100);

            // Store new EMA
            global.State.marketEMA[resourceType] = ema;

            // Sort orders by price descending
            orders.sort((a, b) => b.price - a.price);

            for (const order of orders) {
                // Sell if price is above EMA and spread is good enough to cover energy costs
                if (order.price >= ema) {
                    const energyCost = Game.market.calcTransactionCost(MIN_SELL_AMOUNT, room.name, order.roomName);
                    // Basic sanity check: Is the energy cost worth the trade?
                    // (Assuming energy is worth roughly 1 credit for this simple example, can be adjusted)
                    if (terminal.store[RESOURCE_ENERGY] >= energyCost) {
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
