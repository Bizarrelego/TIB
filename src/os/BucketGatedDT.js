const DistanceTransform = require('../algorithms/distanceTransform');
const MinCut = require('../algorithms/minCut');

class BucketGatedDT {
    /**
     * Compute a distance transform, delaying if CPU bucket is below threshold.
     * @param {string} roomName
     * @param {CostMatrix} initialMatrix
     * @param {number} threshold
     * @returns {CostMatrix|string} The distance transform, or 'deferred'
     */
    static compute(roomName, initialMatrix, threshold = 8000) {
        if (typeof Game !== 'undefined' && Game.cpu && Game.cpu.bucket !== undefined) {
            if (Game.cpu.bucket <= threshold) {
                return 'deferred';
            }
        }
        return DistanceTransform.compute(roomName, initialMatrix);
    }

    /**
     * Compute min cut, delaying if CPU bucket is below threshold.
     * @param {string} roomName
     * @param {Object[]} sources
     * @param {CostMatrix} bounds
     * @param {number} threshold
     * @returns {RoomPosition[]|string} Array of positions, or 'deferred'
     */
    static getCutTiles(roomName, sources, bounds, threshold = 8000) {
        if (typeof Game !== 'undefined' && Game.cpu && Game.cpu.bucket !== undefined) {
            if (Game.cpu.bucket <= threshold) {
                return 'deferred';
            }
        }
        return MinCut.getCutTiles(roomName, sources, bounds);
    }
}

module.exports = BucketGatedDT;
