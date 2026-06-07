1. **Refactor `RoomStateScanner.js`**
   - Replace native API calls like `room.find(FIND_MINERALS)` with the caching utility `RoomStructureCacheUtility.getStructuresByType`.
   - Update `state.controller = room.controller;` to `state.controller = RoomStructureCacheUtility.getController(roomName);`
   - Wait, `RoomStructureCacheUtility` relies on the central state populated by `GlobalStateScanner`? Let's check `RoomStructureCacheUtility.js`.
