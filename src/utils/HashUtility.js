/**
 * Utility module for generating consistent integer hashes.
 * Used for deterministic assignments (e.g., hash-based targeting).
 * @module HashUtility
 */

/**
 * Generates a deterministic integer hash from a string ID.
 *
 * @param {string} id - The string identifier to hash.
 * @param {number} max - The exclusive maximum value of the hash (must be > 0).
 * @returns {number} A deterministic integer between 0 and max - 1.
 */
function getHash(id, max) {
    if (!id || typeof id !== 'string') return 0;
    if (typeof max !== 'number' || max <= 0) return 0;

    let hash = 0;
    for (let i = 0; i < id.length; i++) {
        const char = id.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }

    // Ensure the hash is positive
    const positiveHash = Math.abs(hash);

    return positiveHash % max;
}

module.exports = {
    getHash
};
