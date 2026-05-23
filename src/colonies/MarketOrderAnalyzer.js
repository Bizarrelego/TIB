/**
 * Analyzes market data to provide advanced market intelligence.
 * Identifies trends, predicts price movements, and detects outliers using IQR.
 *
 * @module MarketOrderAnalyzer
 */

const MarketDataProcessor = require('../utils/MarketDataProcessor.js');

const HISTORY_SIZE = 100;

class MarketOrderAnalyzer {
    /**
     * Accumulates historical market data and analyzes trends.
     * Caches data over multiple ticks natively in `global.State` using a circular buffer.
     *
     * @param {string} resourceType - The resource type to analyze.
     * @param {Object[]} buyOrders - Array of market buy orders.
     * @param {Object[]} sellOrders - Array of market sell orders.
     */
    static analyzeMarketHistory(resourceType, buyOrders, sellOrders) {
        if (!global.State) global.State = new Map();

        let marketHistory = global.State.get('marketHistory');
        if (!marketHistory) {
            marketHistory = new Map();
            global.State.set('marketHistory', marketHistory);
        }

        let resourceHistory = marketHistory.get(resourceType);
        if (!resourceHistory) {
            resourceHistory = {
                data: new Array(HISTORY_SIZE).fill(null),
                index: 0,
                count: 0
            };
            marketHistory.set(resourceType, resourceHistory);
        }

        if (buyOrders.length === 0 && sellOrders.length === 0) return;

        // Simple aggregation for current tick
        const tickData = {
            time: Game.time,
            avgBuyPrice: this._calculateAveragePrice(buyOrders),
            avgSellPrice: this._calculateAveragePrice(sellOrders),
            totalBuyVolume: this._calculateTotalVolume(buyOrders),
            totalSellVolume: this._calculateTotalVolume(sellOrders)
        };

        resourceHistory.data[resourceHistory.index] = tickData;
        resourceHistory.index = (resourceHistory.index + 1) % HISTORY_SIZE;
        resourceHistory.count = Math.min(resourceHistory.count + 1, HISTORY_SIZE);

        // Calculate trends
        const insights = this._calculateInsights(resourceHistory);

        let marketInsights = global.State.get('marketInsights');
        if (!marketInsights) {
            marketInsights = new Map();
            global.State.set('marketInsights', marketInsights);
        }
        marketInsights.set(resourceType, insights);
    }

    /**
     * Calculates the average price of a given set of orders.
     *
     * @param {Object[]} orders - Array of market orders.
     * @returns {number} The average price.
     */
    static _calculateAveragePrice(orders) {
        if (orders.length === 0) return 0;
        const total = orders.reduce((sum, o) => sum + o.price, 0);
        return total / orders.length;
    }

    /**
     * Calculates the total remaining amount of a given set of orders.
     *
     * @param {Object[]} orders - Array of market orders.
     * @returns {number} The total volume.
     */
    static _calculateTotalVolume(orders) {
        return orders.reduce((sum, o) => sum + o.remainingAmount, 0);
    }

    /**
     * Calculates market insights based on historical data.
     *
     * @param {Object} resourceHistory - The circular buffer object containing historical data.
     * @returns {Object|null} The calculated insights or null if no data.
     */
    static _calculateInsights(resourceHistory) {
        if (resourceHistory.count === 0) return null;

        let totalBuyVolume = 0;
        let totalSellVolume = 0;
        let sumAvgBuyPrice = 0;
        let sumAvgSellPrice = 0;

        for (let i = 0; i < resourceHistory.count; i++) {
            const data = resourceHistory.data[i];
            totalBuyVolume += data.totalBuyVolume;
            totalSellVolume += data.totalSellVolume;
            sumAvgBuyPrice += data.avgBuyPrice;
            sumAvgSellPrice += data.avgSellPrice;
        }

        const overallAvgBuyPrice = sumAvgBuyPrice / resourceHistory.count;
        const overallAvgSellPrice = sumAvgSellPrice / resourceHistory.count;

        // Trend: comparing last up to 10 ticks to overall
        let recentTicksCount = Math.min(10, resourceHistory.count);
        let recentAvgBuyPriceSum = 0;
        let recentAvgSellPriceSum = 0;

        for (let i = 0; i < recentTicksCount; i++) {
            // Traverse backwards from current index - 1
            let idx = (resourceHistory.index - 1 - i + HISTORY_SIZE) % HISTORY_SIZE;
            recentAvgBuyPriceSum += resourceHistory.data[idx].avgBuyPrice;
            recentAvgSellPriceSum += resourceHistory.data[idx].avgSellPrice;
        }

        const recentAvgBuyPrice = recentAvgBuyPriceSum / recentTicksCount;
        const recentAvgSellPrice = recentAvgSellPriceSum / recentTicksCount;

        return {
            overallAvgBuyPrice,
            overallAvgSellPrice,
            recentAvgBuyPrice,
            recentAvgSellPrice,
            totalBuyVolume,
            totalSellVolume,
            buyTrend: recentAvgBuyPrice - overallAvgBuyPrice,
            sellTrend: recentAvgSellPrice - overallAvgSellPrice
        };
    }

    /**
     * Identifies the optimal trade price, explicitly excluding outliers using IQR.
     *
     * @param {Object[]} orders - The filtered array of market orders (either buy or sell).
     * @param {string} type - ORDER_BUY or ORDER_SELL.
     * @returns {number|null} The optimal price or null if none found.
     */
    static identifyOptimalTrade(orders, type) {
        if (!orders || orders.length === 0) return null;

        const prices = orders.map(o => o.price);
        const filteredPrices = MarketDataProcessor.filterOutliers(prices);

        if (filteredPrices.length === 0) return null;

        if (type === ORDER_BUY) {
            return Math.max(...filteredPrices); // Max buy price
        } else {
            return Math.min(...filteredPrices); // Min sell price
        }
    }

    /**
     * Detects outliers in raw market orders using IQR filtering.
     *
     * @param {Object[]} buyOrders - Array of buy market orders.
     * @param {Object[]} sellOrders - Array of sell market orders.
     * @returns {Object[]} Array of outlier order objects.
     */
    static detectOutliers(buyOrders, sellOrders) {
        const buyOutliers = this._getOutliersFromGroup(buyOrders);
        const sellOutliers = this._getOutliersFromGroup(sellOrders);

        return [...buyOutliers, ...sellOutliers];
    }

    /**
     * Gets outlier order objects from a specific group of orders.
     *
     * @param {Object[]} orders - Array of market orders.
     * @returns {Object[]} Array of outlier market orders.
     */
    static _getOutliersFromGroup(orders) {
        if (!orders || orders.length < 4) return []; // Not enough data for reliable IQR

        const prices = [];
        for (let i = 0; i < orders.length; i++) {
            prices.push(orders[i].price);
        }

        const filteredPrices = MarketDataProcessor.filterOutliers(prices);

        // If an order's price is not in the filtered prices array, it's an outlier.
        // Or we can calculate bounds again. Using filterOutliers directly:
        const validPricesSet = new Set(filteredPrices);

        const outliers = [];
        for (let i = 0; i < orders.length; i++) {
            if (!validPricesSet.has(orders[i].price)) {
                outliers.push(orders[i]);
            }
        }
        return outliers;
    }
}

module.exports = MarketOrderAnalyzer;
