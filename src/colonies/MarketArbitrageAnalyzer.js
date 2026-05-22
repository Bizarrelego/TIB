/**
 * Analyzes market data to identify profitable arbitrage opportunities.
 * Detects and flags market outliers using an independent IQR filtering implementation.
 *
 * @module MarketArbitrageAnalyzer
 */

const MarketDataProcessor = require('../utils/MarketDataProcessor.js');

/**
 * @typedef {Object} Order
 * @property {string} id - The order ID.
 * @property {number} price - The price of the resource.
 * @property {string} type - The type of order (ORDER_BUY or ORDER_SELL).
 * @property {string} resourceType - The resource type.
 * @property {string} roomName - The room where the order is placed.
 * @property {number} amount - The available amount.
 * @property {number} remainingAmount - The remaining amount.
 * @property {boolean} [isOutlier] - Flag indicating if the order is an outlier.
 */

/**
 * @typedef {Object} ArbitrageOpportunity
 * @property {Order} buyOrder - The order to buy from (market sell order).
 * @property {Order} sellOrder - The order to sell to (market buy order).
 * @property {number} amount - The amount to trade.
 * @property {number} profit - The estimated profit in credits.
 * @property {number} transferCost - The estimated energy transfer cost.
 */

/**
 * Calculates the median of a sorted array of numbers.
 *
 * @param {number[]} sortedData - An array of numbers sorted in ascending order.
 * @returns {number} The median value. Returns NaN if the array is empty.
 */
function calculateMedian(sortedData) {
    if (!sortedData || sortedData.length === 0) {
        return NaN;
    }

    const mid = Math.floor(sortedData.length / 2);
    if (sortedData.length % 2 === 0) {
        return (sortedData[mid - 1] + sortedData[mid]) / 2;
    }
    return sortedData[mid];
}

/**
 * Calculates the first (Q1) and third (Q3) quartiles of a sorted array of numbers.
 *
 * @param {number[]} sortedData - An array of numbers sorted in ascending order.
 * @returns {{q1: number, q3: number}} An object containing the Q1 and Q3 values.
 */
function calculateQuartiles(sortedData) {
    if (!sortedData || sortedData.length === 0) {
        return { q1: NaN, q3: NaN };
    }

    if (sortedData.length === 1) {
        return { q1: sortedData[0], q3: sortedData[0] };
    }

    const mid = Math.floor(sortedData.length / 2);

    // For Q1, take the lower half
    const lowerHalf = sortedData.slice(0, mid);

    // For Q3, take the upper half
    const upperHalfStart = sortedData.length % 2 === 0 ? mid : mid + 1;
    const upperHalf = sortedData.slice(upperHalfStart);

    return {
        q1: calculateMedian(lowerHalf),
        q3: calculateMedian(upperHalf)
    };
}

/**
 * Applies Interquartile Range (IQR) filtering to flag outlier market orders.
 * It modifies the passed orders by setting an `isOutlier` boolean flag on them.
 * This should be applied to orders of the SAME resource type.
 *
 * @param {Order[]} orders - An array of market orders of a specific resource type.
 * @returns {Order[]} The same array of orders with `isOutlier` flags added.
 */
function flagOrderOutliers(orders) {
    if (!orders || orders.length === 0) {
        return [];
    }

    if (orders.length < 4) {
        // Not enough data for IQR; mark all as non-outliers
        orders.forEach(order => {
            order.isOutlier = false;
        });
        return orders;
    }

    const prices = orders.map(order => order.price);
    const sortedPrices = prices.sort((a, b) => a - b);

    const { q1, q3 } = calculateQuartiles(sortedPrices);

    if (isNaN(q1) || isNaN(q3)) {
         orders.forEach(order => {
            order.isOutlier = false;
        });
        return orders;
    }

    const iqr = q3 - q1;
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;

    orders.forEach(order => {
        order.isOutlier = order.price < lowerBound || order.price > upperBound;
    });

    return orders;
}

/**
 * Calculates the potential profit margin for an arbitrage transfer.
 * Arbitrage requires moving resources through our own terminal.
 *
 * @param {Order} buyFromOrder - The order we buy from (market ORDER_SELL).
 * @param {Order} sellToOrder - The order we sell to (market ORDER_BUY).
 * @param {number} amount - The amount to transfer.
 * @param {number} energyPrice - The current market price of energy.
 * @param {string} myRoomName - The name of our room acting as the intermediary.
 * @returns {{ profit: number, transferCost: number }} An object containing the profit and transfer cost.
 */
function calculateArbitrageProfit(buyFromOrder, sellToOrder, amount, energyPrice, myRoomName) {
    // We pay energy to transfer from the seller to our terminal
    const costToBuy = Game.market.calcTransactionCost(amount, buyFromOrder.roomName, myRoomName);

    // We pay energy to transfer from our terminal to the buyer
    const costToSell = Game.market.calcTransactionCost(amount, myRoomName, sellToOrder.roomName);

    const totalTransferCost = costToBuy + costToSell;

    // Profit = (Sell Price - Buy Price) * amount - totalTransferCost * energyPrice
    const profit = (sellToOrder.price - buyFromOrder.price) * amount - (totalTransferCost * energyPrice);

    return {
        profit,
        transferCost: totalTransferCost
    };
}

/**
 * Finds profitable arbitrage opportunities using raw market orders.
 * Arbitrage is defined as buying from a market sell order, routing through our room,
 * and selling to a market buy order at a higher price that covers energy transaction costs.
 * Groups by resourceType to prevent mixing incompatible prices and reduces CPU usage.
 * It strictly ignores orders flagged as outliers.
 *
 * @param {number} energyPrice - The current market price of energy.
 * @param {string} myRoomName - The name of our room acting as the intermediary terminal.
 * @returns {ArbitrageOpportunity[]} An array of profitable arbitrage opportunities, sorted by highest profit.
 */
function findArbitrageOpportunities(energyPrice, myRoomName) {
    // Fetch raw market data from MarketDataProcessor
    let rawOrders = [];
    if (typeof MarketDataProcessor.getRawData === 'function') {
        rawOrders = MarketDataProcessor.getRawData() || [];
    }

    // If returning an object mapped by ID, convert to array
    if (!Array.isArray(rawOrders) && typeof rawOrders === 'object') {
        rawOrders = Object.values(rawOrders);
    }

    // Group orders by resource type
    const ordersByResource = new Map();
    for (const order of rawOrders) {
        if (!ordersByResource.has(order.resourceType)) {
            ordersByResource.set(order.resourceType, { buy: [], sell: [] });
        }
        if (order.type === 'buy') {
            ordersByResource.get(order.resourceType).buy.push(order);
        } else if (order.type === 'sell') {
            ordersByResource.get(order.resourceType).sell.push(order);
        }
    }

    const opportunities = [];

    // Process each resource type individually
    for (const [resourceType, group] of ordersByResource.entries()) {
        const flaggedBuyOrders = flagOrderOutliers(group.buy);
        const flaggedSellOrders = flagOrderOutliers(group.sell);

        // Filter out flagged outliers
        const validBuyOrders = flaggedBuyOrders.filter(order => !order.isOutlier);
        const validSellOrders = flaggedSellOrders.filter(order => !order.isOutlier);

        for (const sellOrder of validSellOrders) { // We buy from these
            for (const buyOrder of validBuyOrders) { // We sell to these
                // The maximum amount we can trade is the minimum of both order amounts
                const amount = Math.min(sellOrder.amount, buyOrder.amount);

                if (amount <= 0) {
                    continue;
                }

                const { profit, transferCost } = calculateArbitrageProfit(sellOrder, buyOrder, amount, energyPrice, myRoomName);

                if (profit > 0) {
                    opportunities.push({
                        buyOrder: sellOrder, // The market sell order is where we buy from
                        sellOrder: buyOrder, // The market buy order is where we sell to
                        amount,
                        profit,
                        transferCost
                    });
                }
            }
        }
    }

    // Sort by most profitable first
    opportunities.sort((a, b) => b.profit - a.profit);

    return opportunities;
}

module.exports = {
    calculateMedian,
    calculateQuartiles,
    flagOrderOutliers,
    calculateArbitrageProfit,
    findArbitrageOpportunities
};
