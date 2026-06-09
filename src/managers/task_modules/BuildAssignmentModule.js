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
    if (!roomState || !roomState.constructionSites || !Array.isArray(roomState.constructionSites)) {
        return [];
    }

    const ids = [];
    for (let i = 0; i < roomState.constructionSites.length; i++) {
        const site = roomState.constructionSites[i];
        if (site && site.id) {
            ids.push(site.id);
        }
    }

    return ids;
}

module.exports = {
    getConstructionSiteIds
};
