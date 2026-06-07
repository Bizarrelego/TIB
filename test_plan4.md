Let me read the system prompt again.
"The architecture must scale, but the current logic must remain primitive. Enforce this strict Brain/Muscle split:
* **The Muscle (Roles):** Creep role files MUST NOT contain logic, `find()`, or targeting decisions. Roles only read `creep.heap.targetId` and `creep.heap.actionIntent` and execute the native API call. If an action fails or completes, the creep sets `creep.heap.state = 'idle'`.
* **The Brain (`TaskAssignmentManager`):** This manager iterates over idle creeps, evaluates the central state, and writes the `targetId` and `actionIntent` to the creep's heap.
* **The Eyes (`GlobalStateScanner`):** Runs at the start of the tick. Parses structures, sources, and drops into O(1) arrays/dictionaries. Managers pull data exclusively from here."

The bot complains:
"While you moved the logic to a scanner, the scanner itself is still executing these expensive calls every tick. Furthermore, the architecture requires the Eyes (GlobalStateScanner) to run at the start of the tick, but your implementation of RoomStateScanner continues to perform heavy polling. You are also using Map() for global state, which is acceptable, but the logic remains fundamentally inefficient by re-scanning the entire room state every tick instead of utilizing cached data structures."

Could it be that we should cache `room.find(FIND_STRUCTURES)` ?
Wait, if it's re-scanning the ENTIRE room state every tick...
How can we avoid re-scanning static things like structures and sources?
Ah! Maybe we only scan them once or when `Game.time % 100 === 0`?
But the comment says "instead of utilizing cached data structures."
What cached data structures?

Let's check if there is a `global.Cache` or something similar.
