/**
 * The Colony abstraction aggregates state for an entire territory (a core room + outposts).
 * Improves data locality and architectural hierarchy by grouping core rooms with their dependent outposts.
 */
class Colony {
    constructor(roomName) {
        this.name = roomName;
        // The array of outpost room names assigned to this colony
        this.outposts = Memory.rooms[roomName]?.outposts || [];
        
        // V8 Monomorphism: Plain arrays populated exactly once per tick by GlobalStateScanner
        this.creeps = [];
        this.creepsByRole = {};
        this.sources = [];
        this.constructionSites = [];
    }

    get coreRoom() {
        return Game.rooms[this.name];
    }
}

module.exports = Colony;
