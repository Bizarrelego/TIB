# TIB Bot Architecture & Coding Standards

## 1. Core CPU & Execution Principles
- **Zero Native Polling**: Never use `room.find()`, `room.lookAt()`, or `room.lookForAt()` inside tick loops. You must only query the pre-scanned maps in `global.State`.
- **Event-Driven Updates**: Rely on `room.getEventLog()` to update state (e.g., detecting attacks or destroyed structures) rather than iterating arrays.
- **Fatigue Gating**: If a creep has `fatigue > 0`, immediately return and skip all logic for that tick.
- **Source Sleep**: If a source is empty, set a `wakeTick` in the creep's heap and skip execution until the regeneration tick.
- **Intent Maximization**: Stack non-conflicting intents (e.g., `move()`, `transfer()`, `rangedHeal()`) in the same tick.

## 2. Memory & State Management
- **Heap Exclusivity**: Write temporary data to `creep.heap` (via `memoryProxy.js`). The native `creep.memory` must ONLY contain `role` and `colony`.
- **V8 Map Optimization**: Use `Map()` for all large dictionaries and lookups, never plain `{}` objects.
- **Error Boundaries**: Every Manager function must be wrapped in an isolated `try/catch` block to prevent global crashes.

## 3. Logistics & Movement
- **Sub-Tick Ledger**: You must use `VirtualLedger` in `trafficManager.js` to register all resource transfers, drops, and pickups to prevent API execution waste.
- **Top-Down Assignment**: Creeps must never scan for jobs. Managers assess the room state and assign targets directly to creeps.
- **Spawn Validation**: Managers must check `SpawnLedger.canSpawn()` to ensure sub-tick energy availability before queueing a spawn.
- **Movement Wrapper**: Native `creep.moveTo()` is banned. Always use `movement.moveTo()` in `src/utils/`.

## 4. Phase Milestones (RCL)
- **RCL 1 (Bootstrap)**: Brute-force the controller. Spawn up to 15 generic `[WORK, CARRY, MOVE]` workers. Do not build roads.
- **RCL 2 (Core Infrastructure)**: Transition to Harvesters (stationary, dropping energy) and Haulers. Haulers prioritize Spawns/Extensions, then drop overflow near the Controller.
- **RCL 3 (Defense)**: Implement Tower logic (Hostiles > Heal > Roads at 10% HP).