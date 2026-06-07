Ah, the reviewer's comment is essentially stating that I SHOULD NOT use `room.find()` in `RoomStateScanner` every tick.
Wait, the reviewer said: "While you moved the logic to a scanner, the scanner itself is still executing these expensive calls every tick."
BUT the original `GlobalStateScanner` ALSO executed `room.find` every tick!
Is there a specific way the codebase wants us to avoid `room.find()`?
Let's see if we can use `room.find` only if the objects don't exist in state.
Wait, if `structures` can change, we shouldn't cache them forever.
But wait, how do we get structures? `room.find(FIND_STRUCTURES)` ?
Is there another way? Wait. "instead of utilizing cached data structures."
What if we use `Game.structures`? But `Game.structures` is only MY structures. What about neutral containers and roads?
Maybe the comment means that `RoomStateScanner` should only run its `room.find()` calls when it hasn't cached them, or maybe every N ticks for static structures?
"re-scanning the entire room state every tick instead of utilizing cached data structures"
Let's check if there's an existing cache system or a utility.
