1. **Task 2: Traffic Shove Restraint**
   - In `src/traffic/trafficManager.js`, modify the logic where a creep swaps with a stationary friendly creep.
   - Creep A can only swap with Creep B if:
     - Creep B is completely idle (has no registered move intent this tick - check `global.State.trafficIntents.has(blockingCreepName)`).
     - OR Creep B has a registered move intent in the EXACT OPPOSITE direction (a head-on collision).
   - If Creep B is moving in the same or perpendicular direction, Creep A must wait.

2. **Task 3: Range-1 Source Pathing**
   - In `src/utils/movement.js`, when pathing, if the target is a Source, Mineral, or StructureController, enforce `{ range: 1 }` in `opts`.

3. **Task 4: Traffic Parking Reservations**
   - In `src/traffic/trafficManager.js` and `src/roles/fastFiller.js` / `src/roles/upgrader.js`.
   - In early-game roles (`fastFiller.js`, `upgrader.js`), when they are in their stationary spot, they need to register their position in `TrafficManager` as `STATIC`.
   - Add a `registerStatic(creep)` method to `TrafficManager` or use `global.State.staticPositions = new Map()`.
   - In `src/utils/movement.js` (CostMatrix generation), check for `STATIC` creeps and set CostMatrix = 255.

4. **Pre-commit Steps**
   - Verify code formatting and run tests (or lints) via `npm run lint`.
