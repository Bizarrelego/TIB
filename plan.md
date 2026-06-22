1. **Optimize CostMatrix Caching in `TrafficManager.js`**
   - The current code in `TrafficManager.getCostMatrix` calls `baseMatrix.serialize()` when generating a new `PathFinder.CostMatrix` and caches the serialized array.
   - On subsequent calls, it uses `PathFinder.CostMatrix.deserialize(cached.matrix)` to recreate the matrix.
   - `PathFinder.CostMatrix.deserialize` and `.serialize` are expensive operations, mapping arrays across the V8 to C++ boundary in Screeps.
   - Since `baseMatrix` is cloned via `tickMatrix = baseMatrix.clone()` right after retrieval, the `baseMatrix` itself is never mutated and can be safely cached as an object instance without serialization.
   - Change `global.Cache.costMatrices.set(roomName, { matrix: baseMatrix, ... })` to cache the instance directly, and remove `.deserialize()` and `.serialize()`.
2. **Verify changes**
   - Read the updated file to ensure correctness.
   - Run `npm run lint` and `npm run build` (or equivalent test commands).
3. **Pre-commit Steps**
   - Complete pre commit steps to make sure proper testing, verifications, reviews and reflections are done.
4. **Submit**
