/**
 * @fileoverview Utility module for standardized storage and retrieval of operational data on `creep.heap`.
 * This module ensures `creep.heap` exists before access or modification and provides a safe API to manage heap data
 * to support the 'Heap Exclusivity' principle.
 */

/**
 * Ensures that the creep has a valid heap object.
 * Initializes `creep.heap` as an empty object if it does not already exist.
 *
 * @param {Creep} creep - The target creep.
 */
function ensureHeap(creep) {
    if (!creep) return;
    if (typeof creep.heap !== 'object' || creep.heap === null) {
        creep.heap = {};
    }
}

/**
 * Safely sets a value on the creep's heap under the specified key.
 * Initializes the heap if it doesn't exist.
 *
 * @param {Creep} creep - The target creep.
 * @param {string} key - The property key to set.
 * @param {*} value - The value to store.
 */
function setHeapData(creep, key, value) {
    if (!creep) return;
    ensureHeap(creep);
    creep.heap[key] = value;
}

/**
 * Safely retrieves a value from the creep's heap under the specified key.
 *
 * @param {Creep} creep - The target creep.
 * @param {string} key - The property key to retrieve.
 * @returns {*} The value stored under the given key, or `undefined` if the key or heap does not exist.
 */
function getHeapData(creep, key) {
    if (!creep) return undefined;
    ensureHeap(creep);
    return creep.heap[key];
}

/**
 * Safely deletes a key and its associated value from the creep's heap.
 *
 * @param {Creep} creep - The target creep.
 * @param {string} key - The property key to delete.
 */
function deleteHeapData(creep, key) {
    if (!creep) return;
    ensureHeap(creep);
    delete creep.heap[key];
}

module.exports = {
    ensureHeap,
    setHeapData,
    getHeapData,
    deleteHeapData
};
