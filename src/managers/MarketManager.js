const MarketDataProcessor = require('../utils/MarketDataProcessor');

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

        if (!global.State) global.State = new Map();
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

        // Arbitrage Logic: Evaluate global buy/sell orders.
        // We look through all known orders to find arbitrage opportunities.
        const allBuyOrders = Game.market.getAllOrders({ type: ORDER_BUY });
        const allSellOrders = Game.market.getAllOrders({ type: ORDER_SELL });

        if (!allBuyOrders || !allSellOrders) return;

        // Group by resource
        const buyOrdersByResource = new Map();
        for (const order of allBuyOrders) {
            if (!buyOrdersByResource.has(order.resourceType)) buyOrdersByResource.set(order.resourceType, []);
            buyOrdersByResource.get(order.resourceType).push(order);
        }

        const sellOrdersByResource = new Map();
        for (const order of allSellOrders) {
            if (!sellOrdersByResource.has(order.resourceType)) sellOrdersByResource.set(order.resourceType, []);
            sellOrdersByResource.get(order.resourceType).push(order);
        }

        for (const [resourceType, buyOrders] of buyOrdersByResource.entries()) {
            const sellOrders = sellOrdersByResource.get(resourceType) || [];
            if (sellOrders.length === 0 || buyOrders.length === 0) continue;

            // Apply IQR Filter to reject troll orders
            const buyPrices = buyOrders.map(o => o.price);
            const filteredBuyPrices = MarketDataProcessor.filterOutliers(buyPrices);

            const sellPrices = sellOrders.map(o => o.price);
            const filteredSellPrices = MarketDataProcessor.filterOutliers(sellPrices);

            if (filteredBuyPrices.length === 0 || filteredSellPrices.length === 0) continue;

            // Valid bounds
            const minBuyPrice = Math.min(...filteredBuyPrices);
            const maxBuyPrice = Math.max(...filteredBuyPrices);
            const validBuyOrders = buyOrders.filter(o => o.price >= minBuyPrice && o.price <= maxBuyPrice);

            const minSellPrice = Math.min(...filteredSellPrices);
            const maxSellPrice = Math.max(...filteredSellPrices);
            const validSellOrders = sellOrders.filter(o => o.price >= minSellPrice && o.price <= maxSellPrice);

            if (validBuyOrders.length === 0 || validSellOrders.length === 0) continue;

            // EMA Baseline
            const currentAvgBuyPrice = filteredBuyPrices.reduce((sum, p) => sum + p, 0) / filteredBuyPrices.length;

            if (!global.State.marketEMA) global.State.marketEMA = new Map();
            const prevEma = global.State.marketEMA.get(resourceType) || currentAvgBuyPrice;
            const ema = MarketDataProcessor.calculateEMA(currentAvgBuyPrice, prevEma, 100);
            global.State.marketEMA.set(resourceType, ema);

            // Sort logic: Highest Buy Price, Lowest Sell Price
            validBuyOrders.sort((a, b) => b.price - a.price);
            validSellOrders.sort((a, b) => a.price - b.price);

            const highestBuy = validBuyOrders[0];
            const lowestSell = validSellOrders[0];

            // Calculate Arbitrage Margin
            const margin = highestBuy.price - lowestSell.price;

            if (margin > 0) {
                // Cost calculation
                // Arbitrage via terminal requires us to act as the intermediate or use our energy to cover transfers.
                // Actually, if we buy from `lowestSell` it costs energy to transfer to us.
                // Then selling to `highestBuy` costs energy to transfer from us to them.
                // But wait, `Game.market.deal` takes `targetRoomName` as the room with the terminal.
                // We buy from `lowestSell.roomName` to our `room.name`.
                // We sell to `highestBuy.roomName` from our `room.name`.

                const amountToTrade = Math.min(highestBuy.remainingAmount, lowestSell.remainingAmount, 1000); // 1000 limit per tick

                if (amountToTrade > 0) {
                    const energyCostBuy = Game.market.calcTransactionCost(amountToTrade, room.name, lowestSell.roomName);
                    const energyCostSell = Game.market.calcTransactionCost(amountToTrade, room.name, highestBuy.roomName);

                    const totalEnergyCost = energyCostBuy + energyCostSell;
                    const transferCostPerUnit = totalEnergyCost / amountToTrade;

                    // If the margin between global buy and sell orders exceeds terminal energy transfer cost, execute both
                    if (margin > transferCostPerUnit && terminal.store[RESOURCE_ENERGY] >= totalEnergyCost) {
                        const buyResult = Game.market.deal(lowestSell.id, amountToTrade, room.name);
                        const sellResult = Game.market.deal(highestBuy.id, amountToTrade, room.name);

                        if (buyResult === OK && sellResult === OK) {
                            console.log(`[MarketManager] Arbitrage Executed for ${resourceType}: Margin ${margin.toFixed(3)}, Profit ${(margin * amountToTrade).toFixed(3)}`);
                            break; // Stop after executing a successful arbitrage
                        }
                    }
                }
            }
        }
    }
}

module.exports = MarketManager;
