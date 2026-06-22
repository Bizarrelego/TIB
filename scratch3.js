// If we cache the CostMatrix instance instead of the serialized array, do we break anything?
// Screeps CostMatrix instances are mutable, but `TrafficManager` modifies a clone.
// "tickMatrix = baseMatrix.clone();"
// Then modifications are applied to `tickMatrix`!
// So `baseMatrix` remains pure!
//
// Thus, we can completely eliminate `.serialize()` and `.deserialize()` overhead.
