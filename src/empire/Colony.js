/**
 * The Colony abstraction aggregates state for an entire territory (a core room + outposts).
 * Improves data locality and architectural hierarchy by grouping core rooms with their dependent outposts.
 */
class Colony {
    constructor(roomName) {
        this.name = roomName;
        // The array of outpost room names assigned to this colony
        this.outposts = Memory.rooms[roomName]?.outposts || [];
    }

    get coreRoom() {
        return Game.rooms[this.name];
    }

    /**
     * Gets all creeps assigned to this colony (including outposts)
     */
    get creeps() {
        if (!global.State || !global.State.rooms) return [];
        
        let allCreeps = [];
        
        // Grab creeps from the core room
        const coreState = global.State.rooms.get(this.name);
        if (coreState && coreState.creeps) {
            allCreeps = allCreeps.concat(coreState.creeps);
        }

        // Grab creeps from the outposts
        for (let i = 0; i < this.outposts.length; i++) {
            const outpostState = global.State.rooms.get(this.outposts[i]);
            if (outpostState && outpostState.creeps) {
                // Only include creeps whose memory explicitly matches this colony
                for (let j = 0; j < outpostState.creeps.length; j++) {
                    const c = outpostState.creeps[j];
                    if (c.memory.colony === this.name) {
                        allCreeps.push(c);
                    }
                }
            }
        }
        
        return allCreeps;
    }

    /**
     * Gets all sources in the colony's territory
     */
    get sources() {
        if (!global.State || !global.State.rooms) return [];
        let allSources = [];
        
        const coreState = global.State.rooms.get(this.name);
        if (coreState && coreState.sources) {
            allSources = allSources.concat(coreState.sources);
        }

        for (let i = 0; i < this.outposts.length; i++) {
            const outpostState = global.State.rooms.get(this.outposts[i]);
            if (outpostState && outpostState.sources) {
                allSources = allSources.concat(outpostState.sources);
            }
        }
        return allSources;
    }

    /**
     * Gets all construction sites in the colony's territory
     */
    get constructionSites() {
        if (!global.State || !global.State.rooms) return [];
        let allSites = [];
        
        const coreState = global.State.rooms.get(this.name);
        if (coreState && coreState.constructionSites) {
            allSites = allSites.concat(Object.values(coreState.constructionSites));
        }

        for (let i = 0; i < this.outposts.length; i++) {
            const outpostState = global.State.rooms.get(this.outposts[i]);
            if (outpostState && outpostState.constructionSites) {
                allSites = allSites.concat(Object.values(outpostState.constructionSites));
            }
        }
        return allSites;
    }
}

module.exports = Colony;
