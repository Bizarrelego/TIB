1. **Create `src/state/RoomStateScanner.js`**
   - Extract the `createRoomStateTemplate` function and the room scanning loop (over `Game.rooms`) from `GlobalStateScanner.js` into a new ES6 class `RoomStateScanner` with a static method `run(roomStatesMap)`.
   - Include imports for `RepairTargetUtility`, `EnergySourceUtility`, and `DroppedResourceUtility` since they are used during room scanning.
   - Return the data or modify `roomStatesMap` directly to ensure no performance degradation.

2. **Update `src/state/GlobalStateScanner.js`**
   - Import `RoomStateScanner`.
   - Remove the `createRoomStateTemplate` function and the room scanning loop over `Game.rooms`.
   - In `run()`, call `RoomStateScanner.run(global.State.rooms)`.
   - Keep the `Game.creeps` loop and `IntelManager.run()` as they are, fulfilling the orchestration role of `GlobalStateScanner`.

3. **Verify functionality**
   - Run ESLint to ensure no syntax errors.
   - Run `npm run build` or tests to ensure successful compilation and correctness without regressions.

4. **Complete pre-commit steps to ensure proper testing, verification, review, and reflection are done.**
