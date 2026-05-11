# TIB Bot Architecture & Coding Standards (Tigga-Style)

## 1. Core CPU & Execution Principles
- **Strict Token Limits (Modularity)**: No single file may exceed 150 lines of code. If a manager requires more logic, you must fragment it into localized sub-modules within its respective directory. Never rewrite an entire file just to change a few lines.
- **Strict JavaScript Exclusivity**: You must strictly write .js files. Do not create, write, or import .ts (TypeScript) files. The CI pipeline and native Screeps engine do not have a TypeScript compiler. Writing TypeScript will cause a fatal server crash.
- **Zero Native Polling**: Never use `room.find()`, `room.lookAt()`, or `room.lookForAt()` inside tick loops. Query pre-scanned maps in `global.State`.
- **Event-Driven Updates (0-CPU Radar)**: Rely on `room.getEventLog()` to detect attacks, destroyed structures, or completed builds instead of array iteration.
- **Fatigue Gating**: If a creep has `fatigue > 0`, instantly return and skip all logic for that tick.
- **Source Sleep**: If a source is empty, set a `wakeTick` in the creep's heap equal to `Game.time + source.ticksToRegeneration` and halt execution until that tick.
- **Intent Maximization**: Stack non-conflicting intents (e.g., `move()`, `transfer()`, `rangedHeal()`) in the same tick. Do not wait for one intent to resolve to execute another.
- **Aggressive Tick Slicing**: Stagger non-critical systems based on CPU limits. Run traffic every tick, but spawn and economy logic can sleep (e.g., `Game.time % 10 === 0`).
- **Cascading CPU Throttling**: Use hardcoded switch statements to cut non-essential operations when the bucket drops below critical thresholds (e.g., 5000, 1000). Prioritize survival (Defense, Logistics).
- **CostMatrix Caching**: Generate CostMatrices exactly once. Serialize and store them in the heap. Only rebuild when `room.getEventLog()` detects a structure built/destroyed.
- **Custom Profiler**: Wrap all manager functions in a custom sub-millisecond profiler. Track average CPU over a 1000-tick window. Do NOT use the public `screeps-profiler` package.
- **Wasm Scaffolding**: Javascript is too slow for endgame math. Configure the build pipeline to compile WebAssembly (Rust/C++) for heavy algorithms like Min-Cut and Distance Transforms.

## 2. Memory & OS Management
- **Heap Exclusivity**: Proxy memory to the heap. The native `creep.memory` must ONLY contain minimal persistent data (role, colony). Write all operational data to `creep.heap`.
- **V8 Map Optimization**: Use `Map()` for all O(1) lookups and large dictionaries, never plain `{}` objects. Utilize `structuredClone()` for deep copies.
- **Error Boundaries**: Wrap every Manager function in an isolated `try/catch` block. A single exception must never halt the entire Node.js loop.
- **Memory Segmentation**: Bypass the 2MB standard memory cap by mapping cross-room intel and heatmaps to `RawMemory` segments (e.g., 0-10 for Intel, 11-20 for Transforms).
- **Heap Rehydration**: Explicitly detect server global resets. If `global.Cache` is wiped, instantly reconstruct critical O(1) dictionaries.
- **Heap Event Bus (PubSub)**: Subsystems must subscribe to events. Managers only execute when an event is emitted (e.g., `EventBus.publish('HOSTILE_SPOTTED')`).

## 3. Logistics, Economy & Pathing
- **Sub-Tick Ledger**: Use a virtual ledger in the Traffic Manager to register all resource transfers to prevent API execution waste (e.g., `ERR_NOT_ENOUGH_RESOURCES`).
- **Top-Down Assignment**: Creeps never scan for jobs. Managers assess the room state, pop the highest urgency task, and assign targets directly to creeps in O(1) or O(N).
- **Containerless Remote Mining**: Drop remote energy directly on the ground. Dynamically size haulers to sweep it before decay to save 250k energy in container repairs.
- **Simultaneous Swarm Swapping (Shoving)**: If Creep A moves into Creep B, and B is idle, issue an opposite move intent to B so both pass in one tick.
- **Deadlock Resolution Engine**: Implement a DFS algorithm in the Traffic Manager to detect cyclic gridlocks in creep move intents. Force the lowest-priority creep off the road to break cycles.
- **Static Upgrading**: Upgraders never move. Haulers drop energy on the upgrader's exact tile, allowing simultaneous `pickup()` and `upgradeController()`.
- **Pre-Calculated Distance Transforms**: Run Dijkstra/Floyd-Warshall exactly once when a room is discovered to calculate the tick-distance from Spawn to all sources. Cache to `RawMemory`.
- **Train Hauling**: Decouple payload from movement on highways. Use a pure-MOVE engine to pull a 0-MOVE cart (`engine.pull(cart)`, `cart.move(engine)`).

## 4. Base Defense & Planning
- **Single-Site Construction**: Throttle site placement. Only place the next highest priority site after the current one is finished to prevent engine parsing lag.
- **Min-Cut Ramparts**: Generate DistanceTransform grids and apply Ford-Fulkerson to block choke points. Never manually blanket the outer wall.
- **DEFCON State Machine**: Strictly dictate base behavior based on threat level (e.g., DEFCON 2: Halt upgrades, dump storage into ramparts).
- **Rampart Dancing**: Rotate low-HP melee defenders off choke-point ramparts with idle backups using `TrafficManager.registerSwap()` to multiply effective base HP.
- **Active Killbox Funneling**: Intentionally leave a path into the base unramparted but surrounded by towers to force enemies into concentrated fire.

## 5. Combat & Siege Execution
- **Dynamic Body Calculus**: Never hardcode transport/mining bodies. Mathematically calculate exact body arrays based on distance and energy potential.
- **Atomic Quad Movement**: Force 4-creep Quads to move as a single entity using chain-pulling. If one lags, the entire block waits, preventing piecemeal wipes.
- **Predictive Pre-Healing**: Calculate enemy tower targeting logic and apply `heal()` on the same tick damage is received. Do not wait for health to drop.
- **Border Bouncing (I-Frames)**: Exploit 1-tick room transitions. Step into adjacent rooms to drop aggro, dodge slow projectiles, and heal safely before stepping back.
- **Synchronized Burst Fire**: Force attackers to hold fire until all members are ready, then hit the target on the exact same tick to out-pace sustained tower healing.
- **HVT Dijkstra Penetration**: Siege creeps must use a modified Dijkstra flood-fill to calculate the cheapest path through enemy ramparts to destroy High-Value Targets (Spawns, Towers).

## 6. Asymmetric Warfare & Meta-Game
- **Early Poaching**: Target poorly defended neighbor remotes. Spawn cheap attackers to kill harvesters, followed by looters to steal the dropped energy.
- **Remote Denial (Harassment)**: Send a 150-energy decoy to permanently loiter in an enemy remote to kite defenders, starving their upgrades.
- **Market Arbitrage**: Constantly scan the order book. Execute trades if the spread exceeds the energy transfer cost.
- **Market Outlier Rejection**: Filter 1-unit orders at 1,000,000 credits using Interquartile Range (IQR) before calculating Exponential Moving Averages (EMA).

## 7. Phase Milestones (RCL)
- **RCL 1 (Bootstrap)**: Brute-force controller. Spawn 15 generic workers. No roads/structures. Use drop-mining.
- **RCL 2 (Core)**: 5 extensions adjacent to spawn. Source/Controller containers. Split into harvesters/haulers.
- **RCL 3 (Defense)**: 1 Tower. Central roads. Tower logic: Hostiles > Heals > Roads at 10% HP. Scale haulers.
- **RCL 4 (Storage)**: Build Storage buffer. Deploy remote defenders/harvesters to 1-2 rooms. Hub logistics begin.
- **RCL 5 (Links)**: 2 Links (Source to Hub). Retire domestic haulers for that source.
- **RCL 6 (Market)**: Terminal & Extractor. EMA market scripts online. 3 Labs.
- **RCL 7 (Industry)**: 2nd Spawn & Factory. Compress surplus energy to batteries. 4th Link beams to Upgrader.
- **RCL 8 (Empire)**: 3rd Spawn, Power Spawn, Observer, Nuker. 10 Labs. Automated claim operations launch.

## 8. Agent/Role Directory
**Logistics**
- `fastFiller`: Stationary micro-hub filler (Storage -> Spawns/Extensions).
- `hubManager`: Transfers energy between central structures (Links, Storage, Terminal).
- `hauler`: Primary energy transport.
- `domesticHauler`: Early-RCL localized transport.

**Economy & Outposts**
- `harvester`: Stationary source miner. Zero-pathing execution.
- `upgrader`: Stationary controller booster.
- `worker`: RCL 1-2 generic multi-tool.
- `reservationGuard` / `remoteDefender`: Protects outposts.

**Defense & Offense**
- `rampartMelee` / `rampartRanged`: Choke-point defenders.
- `quadAttacker` / `quadHealer`: Atomic 4-creep siege blocks.
- `drainerHunter`: Edges tower ranges to bleed enemy energy reserves.
- `soloDismantler`: HVT Dijkstra pathing block-breaker.
- `coreSniper`: Parks on low-RCL enemy controllers to force downgrades.

**Asymmetric & Special Ops**
- `decoy`: Naked 50-energy creep blocking neighbor construction sites.
- `highwayPatrol`: Intercepts unguarded logistics.
- `hostileStorageLooter`: Cleans up dropped energy from poached remotes.
- `skMiner` / `skGuard` / `skHauler`: Timed lair exploitation.
- `powerAttacker` / `powerHealer` / `powerHauler`: High-burst bank cracking.
- `claimer` / `pioneerHarvester` / `pioneerQueen`: Automated room claiming (Bucket > 9000).
- `emergencyBuilder`: MVC (Minimal Viable Creep) for Death Spiral recovery.