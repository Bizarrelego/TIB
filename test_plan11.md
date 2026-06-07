Wait, let me write a robust caching implementation in `RoomStateScanner.js`.
I will use `state.cache` which is attached to the reused state object.

```javascript
const RepairTargetUtility = require('../utilities/RepairTargetUtility');
const EnergySourceUtility = require('../utilities/EnergySourceUtility');
const DroppedResourceUtility = require('../utilities/DroppedResourceUtility');
const GameObjectUtility = require('../utilities/GameObjectUtility');

const createRoomStateTemplate = () => ({
    // ...
    cache: {
        scannedAt: 0,
        mineralId: null,
        sourceIds: [],
        structureIds: [],
        lastConstructionSiteCount: 0
    }
});
```

When should we invalidate the structures cache?
1. `Game.time % 50 === 0` (fallback)
2. `state.cache.lastConstructionSiteCount !== state.constructionSites.length` (a site was finished or placed). Wait, `room.find(FIND_MY_CONSTRUCTION_SITES)` is cheap. We do that every tick.
3. Check `EventLog` for `EVENT_OBJECT_DESTROYED` or `EVENT_BUILD`? The scanner already gets the event log to check for hostiles! We can just scan it for destruction.

```javascript
            const events = room.getEventLog();
            let hasHostileEvent = false;
            let structuresChanged = false;

            for (let i = 0; i < events.length; i++) {
                const event = events[i].event;
                if (event === EVENT_ATTACK || event === EVENT_HEAL) {
                    hasHostileEvent = true;
                }
                if (event === EVENT_OBJECT_DESTROYED || event === EVENT_BUILD) {
                    structuresChanged = true;
                }
            }
```

Wait, `EVENT_BUILD` happens when a creep builds a site, NOT when it completes! When it completes, the site is destroyed (`EVENT_OBJECT_DESTROYED`? No, sites just disappear).
Actually, just tracking the count of construction sites is usually enough to know if one finished.
Also `Game.time % 13 === 0` is already there for radar, let's just refresh structures every 13 ticks, or if construction sites count changes.

Let me draft the new `RoomStateScanner.js`.
