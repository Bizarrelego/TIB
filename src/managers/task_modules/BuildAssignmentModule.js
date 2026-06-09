/**
 * Module for identifying construction sites.
 * @module BuildAssignmentModule
 */

/**
 * Returns a list of construction site IDs from the room state.
 * @param {Object} roomState - The current room state.
 * @returns {string[]} An array of construction site IDs.
 */
function getConstructionSiteIds(roomState) {
    if (!roomState || !roomState.constructionSites) {
        return [];
    }

    // roomState.constructionSites is now an O(1) dictionary keyed by ID
    return Object.keys(roomState.constructionSites);
}

module.exports = {
    getConstructionSiteIds
};
