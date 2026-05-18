/**
 * MarketDataProcessor utility module.
 * Provides pure functions to apply Interquartile Range (IQR) filtering
 * to market data arrays (e.g., prices or volumes) to reject outliers.
 *
 * @module MarketDataProcessor
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
 * Returns {q1: NaN, q3: NaN} if the array is empty.
 */
function calculateQuartiles(sortedData) {
    if (!sortedData || sortedData.length === 0) {
        return { q1: NaN, q3: NaN };
    }

    if (sortedData.length === 1) {
        return { q1: sortedData[0], q3: sortedData[0] };
    }

    const mid = Math.floor(sortedData.length / 2);

    // For Q1, take the lower half. If length is odd, do not include the median itself in the halves.
    const lowerHalf = sortedData.slice(0, mid);

    // For Q3, take the upper half.
    const upperHalfStart = sortedData.length % 2 === 0 ? mid : mid + 1;
    const upperHalf = sortedData.slice(upperHalfStart);

    return {
        q1: calculateMedian(lowerHalf),
        q3: calculateMedian(upperHalf)
    };
}

/**
 * Filters an array of numbers, removing outliers using the Interquartile Range (IQR) method.
 * Outliers are defined as values that fall below Q1 - 1.5 * IQR or above Q3 + 1.5 * IQR.
 *
 * @param {number[]} dataArray - An array of numerical values (e.g., market prices or volumes).
 * @returns {number[]} A new array containing only the values that are within the IQR boundaries.
 */
function filterOutliers(dataArray) {
    if (!dataArray || dataArray.length === 0) {
        return [];
    }
    if (dataArray.length < 4) {
        // Not enough data points to reliably filter using IQR, return a copy of the original array.
        return [...dataArray];
    }

    const sortedData = [...dataArray].sort((a, b) => a - b);
    const { q1, q3 } = calculateQuartiles(sortedData);

    if (isNaN(q1) || isNaN(q3)) {
        return [...dataArray];
    }

    const iqr = q3 - q1;
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;

    return dataArray.filter(value => value >= lowerBound && value <= upperBound);
}

/**
 * Calculates the Exponential Moving Average (EMA).
 *
 * @param {number} newValue - The current value.
 * @param {number} prevEma - The previously calculated EMA.
 * @param {number} periods - The number of periods.
 * @returns {number} The newly calculated EMA.
 */
function calculateEMA(newValue, prevEma, periods = 100) {
    if (prevEma === null || prevEma === undefined) return newValue;
    const k = 2 / (periods + 1);
    return (newValue * k) + (prevEma * (1 - k));
}

module.exports = {
    calculateMedian,
    calculateQuartiles,
    filterOutliers,
    calculateEMA
};
