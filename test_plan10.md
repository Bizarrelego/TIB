Let's see what needs caching:
Sources
Minerals
Structures (All types)
Hostiles (handled by Bolt Radar: `if (hasHostileEvent || ... || Game.time % 13 === 0)`)
Drops, Ruins, Tombstones (have to be polled every tick since they decay or appear instantly, or wait, ruins/tombstones only appear on death, maybe EventLog? Drops appear on drop, maybe EventLog?)

Wait! Can we use `room.find` periodically and save the IDs in `Memory.rooms[roomName]` or `global.State.rooms.get(roomName).cache` ?
The reviewer says: "You are also using Map() for global state, which is acceptable, but the logic remains fundamentally inefficient by re-scanning the entire room state every tick instead of utilizing cached data structures."

If I change `RoomStateScanner.js` to do:
```js
const GameObjectUtility = require('../utilities/GameObjectUtility');

// inside run
if (!state.cache) {
    state.cache = {
        scannedAt: 0,
        mineralId: null,
        sourceIds: [],
        structureIds: []
    };
}

if (Game.time - state.cache.scannedAt > 50 || !state.cache.scannedAt) {
    const mineral = room.find(FIND_MINERALS)[0];
    state.cache.mineralId = mineral ? mineral.id : null;
    state.cache.sourceIds = room.find(FIND_SOURCES).map(s => s.id);
    state.cache.structureIds = room.find(FIND_STRUCTURES).map(s => s.id);
    state.cache.constructionSiteIds = room.find(FIND_MY_CONSTRUCTION_SITES).map(s => s.id);
    state.cache.scannedAt = Game.time;
}

state.mineral = state.cache.mineralId ? GameObjectUtility.getById(state.cache.mineralId) : null;
state.sources = state.cache.sourceIds.map(id => GameObjectUtility.getById(id)).filter(Boolean);
state.constructionSites = state.cache.constructionSiteIds.map(id => GameObjectUtility.getById(id)).filter(Boolean);

const structures = state.cache.structureIds.map(id => GameObjectUtility.getById(id)).filter(Boolean);
```
Wait, if a construction site finishes, it becomes a structure! If we wait 50 ticks, the creep might stand there doing nothing.
Construction sites need to be checked more often, or we check the EventLog for `EVENT_BUILD` or `EVENT_OBJECT_DESTROYED`?
Actually, finding drops, ruins, tombstones, and construction sites is cheap compared to `FIND_STRUCTURES`.
`FIND_STRUCTURES` is notoriously expensive.

Let's do caching for `FIND_STRUCTURES` and `FIND_SOURCES` and `FIND_MINERALS`.
Wait, how do we know if a structure is built?
If `Game.time % 11 === 0` we scan structures?
Or we can just use `room.find(FIND_STRUCTURES)` only when `room.find(FIND_MY_CONSTRUCTION_SITES)` count changes?

Let me read the exact comment again.
"The PR violates the core architectural constraint: 'Do not use room.find() or getEventLog() inside creep tick loops'." - this is just a quote from the system prompt, but applied incorrectly to `RoomStateScanner`.
"While you moved the logic to a scanner, the scanner itself is still executing these expensive calls every tick. Furthermore, the architecture requires the Eyes (GlobalStateScanner) to run at the start of the tick, but your implementation of RoomStateScanner continues to perform heavy polling. You are also using Map() for global state, which is acceptable, but the logic remains fundamentally inefficient by re-scanning the entire room state every tick instead of utilizing cached data structures."

This suggests I should use cached arrays of IDs, and update them efficiently.
I'll create a `RoomStateScanner.js` that implements caching!
