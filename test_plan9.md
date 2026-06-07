Let's think. We are using `room.find(FIND_SOURCES)`. But sources NEVER change. We can cache them.
Minerals NEVER change. We can cache them.
Structures change rarely. If we only scan `FIND_STRUCTURES` every 100 ticks (or if `state.structures` is empty), it would save a lot of CPU.
But what about containers that might decay?
Wait! In `RoomStateScanner.js` we have:
`state.mineral = room['find'](FIND_MINERALS)[0] || null;`
`state.sources = room['find'](FIND_SOURCES);`
`state.constructionSites = room['find'](FIND_MY_CONSTRUCTION_SITES);`
`const structures = room['find'](FIND_STRUCTURES);`
`const drops = room['find'](FIND_DROPPED_RESOURCES);`
`const ruins = room['find'](FIND_RUINS);`
`const tombstones = room['find'](FIND_TOMBSTONES);`

If we use caching:
```js
if (!state.sources.length) state.sources = room.find(FIND_SOURCES);
if (!state.mineral) state.mineral = room.find(FIND_MINERALS)[0] || null;
```

For structures, maybe we do:
```js
if (!state.scannedStructures || Game.time % 100 === 0) {
    const structures = room.find(FIND_STRUCTURES);
    state.structureIds = [];
    state.spawns = [];
    // ... clear and populate ...
    state.scannedStructures = true;
} else {
    // we need to update the structures from IDs?
    // Wait, Game objects like StructureSpawn become stale next tick!
    // If we cache `state.spawns` with Game objects, they throw "Object not active" or are invalid on the next tick!
}
```

Is there a `GameObjectUtility.getById` we can use?
Yes! `GameObjectUtility.getById(id)` uses `Game.getObjectById(id)` under the hood.

If we cache `structureIds`, `sourceIds`, etc., we can map over them every tick instead of calling `room.find()`!
`room.find(FIND_STRUCTURES)` is O(N) over all structures and uses engine CPU.
`Game.getObjectById` is fast.
So if we cache the IDs:
```js
if (!state.sourceIds) {
    state.sourceIds = room.find(FIND_SOURCES).map(s => s.id);
}
state.sources = state.sourceIds.map(id => GameObjectUtility.getById(id)).filter(Boolean);
```
Yes! This is EXACTLY what the reviewer means by "utilizing cached data structures" to avoid "re-scanning the entire room state every tick".

Wait, what about dynamic objects?
`FIND_DROPPED_RESOURCES`, `FIND_RUINS`, `FIND_TOMBSTONES`, `FIND_MY_CONSTRUCTION_SITES`.
Do we scan them every tick?
Wait, if a creep drops energy, it creates a dropped resource.
Does `room.find()` have to be used?
Maybe not `room.find()`, but how else do we find drops?
Actually, the codebase has a `GlobalStateScanner` that did exactly this:
```js
        const drops = room['find'](FIND_DROPPED_RESOURCES);
```
Maybe the bot is just complaining about static things like structures and sources?
Let me check if there's a way to find drops without `room.find()`.
No, in Screeps, you must use `room.find` or `room.lookAtArea` for drops.
But for structures and sources, you can definitely cache the IDs.

Let me adjust `RoomStateScanner.js` to cache IDs in the state.
Wait, `state` persists across ticks!
