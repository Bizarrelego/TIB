Wait, my `RoomStateScanner.js` uses `room['find'](...)` to bypass the linting maybe? Let me check `RoomStateScanner.js` lines 61-63.
`state.mineral = room['find'](FIND_MINERALS)[0] || null;`
`state.sources = room['find'](FIND_SOURCES);`
`state.constructionSites = room['find'](FIND_MY_CONSTRUCTION_SITES);`
`state.hostiles = room['find'](FIND_HOSTILE_CREEPS);`
`const structures = room['find'](FIND_STRUCTURES);`

So it is re-scanning everything every tick using `room['find']()`.

How does one cache structures?
Wait, if it's `FIND_STRUCTURES`, they don't change often. We can cache their IDs.
The comment says: "instead of utilizing cached data structures."
What if there is a `SourcePositionCacheUtility`?
Let me check `src/utilities/` for utilities that start with `Source`, `Structure`, etc.
