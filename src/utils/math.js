/**
 * Core Mathematical Utility Functions
 * Used heavily by Market Arbitrage to filter outlier bait orders and calculate EMA.
 */

class MathUtils {
    /**
     * Calculates the Exponential Moving Average
     * @param {number} newValue The current price/value
     * @param {number} prevEma The previous calculated EMA
     * @param {number} periods Lookback periods (e.g. 100)
     * @returns {number} The new EMA
     */
    static calculateEMA(newValue, prevEma, periods = 100) {
        if (prevEma === null || prevEma === undefined) return newValue;
        const k = 2 / (periods + 1);
        return (newValue * k) + (prevEma * (1 - k));
    }

    /**
     * Interquartile Range (IQR) Filtering
     * Rejects 1-unit bait orders or extreme market outliers before feeding into EMA.
     * @param {number[]} values Array of numerical values (e.g., market order prices)
     * @param {number} multiplier Standard is 1.5. Higher allows more variance.
     * @returns {number[]} Array of values with outliers removed
     */
    static filterOutliersIQR(values, multiplier = 1.5) {
        if (values.length < 4) return values; // Not enough data to filter

        // Sort ascending
        const sorted = [...values].sort((a, b) => a - b);

        const q1 = MathUtils.getQuartile(sorted, 0.25);
        const q3 = MathUtils.getQuartile(sorted, 0.75);
        const iqr = q3 - q1;

        const lowerBound = q1 - (multiplier * iqr);
        const upperBound = q3 + (multiplier * iqr);

        return sorted.filter(val => val >= lowerBound && val <= upperBound);
    }

    /**
     * Helper to get quartile from sorted array.
     * Interpolates values if the exact quartile position is not an integer.
     * @param {number[]} sortedArr Array of numbers, pre-sorted in ascending order
     * @param {number} q The quartile to calculate (e.g., 0.25 for Q1, 0.75 for Q3)
     * @returns {number} The calculated quartile value
     */
    static getQuartile(sortedArr, q) {
        const pos = (sortedArr.length - 1) * q;
        const base = Math.floor(pos);
        const rest = pos - base;

        if (sortedArr[base + 1] !== undefined) {
            return sortedArr[base] + rest * (sortedArr[base + 1] - sortedArr[base]);
        } else {
            return sortedArr[base];
        }
    }
}

module.exports = MathUtils;
