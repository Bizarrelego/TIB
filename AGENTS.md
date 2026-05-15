TIB Bot Architecture & Coding Standards (Tigga-Style)

1. Core CPU & Execution Principles

Strict JS & JSDoc Mandate: .js only. Extensive JSDoc (@param, @typedef, @returns) is mandatory for IDE intellisense and structural integrity.

Zero Native Polling: No room.find(), room.lookAt(), or room.lookForAt() in tick loops. Use global.State.

Event-Driven Updates (0-CPU Radar): Parse room.getEventLog() for attacks, structure decay, or construction.

Fatigue Gating: Instantly return and skip tick logic if fatigue > 0.

Source Sleep: Sleep execution until wakeTick (Game.time + source.ticksToRegeneration) if a source is empty.

Intent Maximization & Pipeline Locking: Stack non-conflicting intents. Lock pipelines (Movement, Melee, Ranged, Utility) via memory proxy to prevent engine overwrites.

Aggressive Tick Slicing: Sleep non-critical systems (e.g., evaluate spawns every 10 ticks) to maintain a low CPU floor.

Cascading CPU Throttling: Hardcoded switch statements cut operations based on bucket limits. Run Game.cpu.generatePixel() exactly at 10k bucket.

Bucket-Gated Distance Transforms: Delay massive CPU spikes (DT/Min-Cut) until the CPU bucket hits > 8000.

Custom Profiler: Wrap managers in a sub-millisecond profiler tracking 1000-tick averages. No public packages.

Wasm Scaffolding: Compile WebAssembly (Rust/C++) for heavy algorithms (Min-Cut, Distance Transforms).

2. 6-Phase Execution Pipeline

Phase 1: OS Init & Cache: Validate heap, completely bypass standard memory parse.

Phase 2: Global State: Iterate game objects exactly once to build O(1) dictionaries.

Phase 3: Colonies: Room-level progression, spawning, and logistics execution.

Phase 4: Operations: Empire-level logic (Intel, Offense, Expansion, SK Ops).

Phase 5: Traffic Control: DFS collision resolution and shoving logic.

Phase 6: Intents & Sleep: Batch fire commands and serialize memory only if modified.

3. Memory & OS Management

Heap Exclusivity: Proxy memory to heap. creep.memory strictly for persistent data (role, colony). Operational data goes to creep.heap.

V8 Map Optimization: Use Map() for O(1) lookups. Deep copies via structuredClone().

V8 Object Pooling & GC Mitigation: Maintain heap pools for short-lived intent wrappers and large arrays to prevent the garbage collector from causing CPU spikes.

Global Error Boundaries: Wrap managers in isolated try/catch blocks to prevent loop halts.

Global Reset Recovery (Heap Rehydration): Explicitly detect VM resets and rehydrate global.Cache and O(1) dictionaries immediately to prevent ID lookup failures.

CPU Bucket Forecasting: Track bucket trajectory across 10 ticks. Preemptively trigger austerity modes if the average drain exceeds thresholds before hitting 500.

Memory Segmentation: Map cross-room intel and heatmaps to RawMemory segments (e.g., 0-10 Intel, 11-20 Transforms) to bypass the 2MB parse limit.

Event Bus (PubSub): Subsystems subscribe to events (e.g., EventBus.publish('HOSTILE_SPOTTED')). Eliminates polling CPU costs.

Room Terrain Hashing: Hash structure counts and IDs. Skip CostMatrix updates unless the room hash changes.

4. Logistics, Economy & Pathing

Sub-Tick Ledger: Virtual ledger in Traffic Manager registers resource transfers to block execution waste (ERR_NOT_ENOUGH_RESOURCES).

Sub-Tick Spawn Ledger: Virtual ledger for room energy capacity. Prevents multiple managers from queuing expensive creeps simultaneously and triggering engine rejections.

Top-Down Assignment: Managers evaluate state and assign targets directly to creeps in O(1) or O(N). Creeps never scan or "bid".

Creep Pre-Spawning Matrix: Spawns replacements exactly spawnTime + cachedPathLength ticks before predecessor dies. Guarantees 100% source saturation.

Zero-Pathing Stationary Harvesting: Calculate optimal mining spot once. Move there. Never invoke pathing algorithms again.

Batched Construction Throttling: Throttle active construction sites to 3 per room to prevent engine parsing lag while allowing concurrent builder execution.

Ruin & Tombstone Scavenging: Prioritize ruins/tombstones over harvesting to inject free energy and boosts directly into progression.

Static Upgrading: Haulers drop energy on the upgrader's exact tile. Upgraders execute pickup() + upgradeController().

Containerless Mining: Drop remote energy on the ground. Dynamically size haulers to sweep before decay.

Train Hauling: Decouple payload. Pure MOVE engine pulls pure CARRY cart.

5. Traffic & Spatial Routing

Simultaneous Swapping (Shoving): Traffic Manager issues opposite move intents to idle blocking creeps in 1-tile corridors.

Deadlock Resolution: DFS algorithm detects and breaks cyclic move intent gridlocks.

Hardcoded Offset Stamps: Hardcode initial RCL 1-4 layouts relative to Spawn to bypass 15-CPU matrices during the bootstrap phase.

Swamp Avoidance Matrix: Inject custom CostMatrix in early RCL to heavily penalize swamp tiles, forcing creeps onto plains.

Directional CostMatrices: Imposes one-way circular roads in heavy hubs by dynamically editing the CostMatrix to eliminate shoving overhead.

Cross-Room Pathing (Universe A):* Custom routeCallback in Game.map.findRoute strictly avoids hostile rooms and prefers highways.

6. Base Defense & Planning

Min-Cut Ramparts: Ford-Fulkerson applied to DistanceTransform grids for automated choke-point blocking.

Dynamic Heatmaps: Range 3 penalty tiles applied to standard CostMatrices around hostiles for auto-kiting.

DEFCON State Machine: Dictate base behavior via threat tier (e.g., DEFCON 2: Halt upgrades, dump storage into ramparts).

Rampart Dancing: Traffic Manager swaps low-HP defenders with idle backups on choke-points to multiply effective base defense HP.

Active Killbox Funneling: Unramparted, tower-surrounded paths designed to bait and concentrate fire on hostiles.

Automated Nuke Evacuation: Detect incoming nukes and evacuate creeps from the 5x5 blast matrix while redirecting logistics to fortify the core.

7. Combat & Siege Execution

Dynamic Body Calculus: Mathematically generate exact body arrays based on route distance and target energy.

Quad Operations (Rotation & Atomic Movement): 4-creep lockstep chain-pulling. Rotate members clockwise to cycle damage to the backline in 1 tick.

Synchronized Burst Fire: Attackers hold fire until ready, hitting the target on the exact same tick to out-pace tower healing.

Ranged Mass Attack (RMA) Spacing: Maintain Range 2 or 3 to hit all members of an enemy Quad with RMA without taking melee damage.

Predictive Pre-Healing: Assess enemy tower target logic and heal() on the same tick damage connects to survive one-shots.

Border Bouncing (I-Frames): Step into adjacent rooms to drop aggro, dodge projectiles, and heal safely.

HVT Dijkstra Penetration: Calculate cheapest path through rampart segments to bypass decoys and eliminate High-Value Targets.

8. Asymmetric Warfare & Meta-Game

SK & Power Ops Subsystem: Extract max-tier resources from central sectors. Track lair spawn ticks via heap for skGuard locking. Compute exact bank damage thresholds to dispatch powerHaulers perfectly on time.

Early Poaching: Kill remote harvesters and loot dropped energy from weak neighbors.

Remote Denial: Park 150-energy decoys on enemy construction sites to kite defenders and starve outposts.

Core Sniping: Block or kill upgraders in low RCL rooms to trigger controller downgrading and wipe neighbors.

Market Arbitrage: Execute trades only if the market spread exceeds transfer costs.

Market Outliers: Apply Interquartile Range (IQR) filtering before calculating EMA to reject 1-unit bait/spoof orders.

Cross-Shard Synchronization: Deploy InterShardMemory serialization engines to coordinate multi-shard expansion and economy.

Alliance Radar: Multiplex RawMemory segments to share intel matrices instantly across alliance members.

9. Phase Milestones (RCL)

RCL 1: Brute-force controller. 15 generic workers. Drop-mining. No structures.

RCL 2: 5 extensions near spawn. Source/Controller containers. Role split (Harvester/Hauler).

RCL 3: 1 Tower (Hostiles > Heals > Roads 10%). Central roads. Scale haulers.

RCL 4: Storage buffer. Hub logistics begin. Deploy remote mining to 1-2 rooms.

RCL 5: 2 Links (Source-to-Hub). Retire domestic haulers for linked sources.

RCL 6: Terminal & Extractor. EMA market scripts online. 3 Labs.

RCL 7: 2nd Spawn & Factory. Compress surplus into batteries. 4th Link to Upgrader.

RCL 8: 3rd Spawn, Power Spawn, Observer, Nuker. 10 Labs. Auto-claim operations launch.

10. Creep Dictionary & Role Schematics

Logistics & Infrastructure

fastFiller: RCL 4+. Stationary micro-hub. Pulls from Storage/Link, fills Spawns/Exts.

hubManager: RCL 5+. Parks between Hub Link, Storage, Terminal. Sub-tick ledger transfers.

hauler: Remote mining. Sweeps dropped energy/ruins. Fills storage or upgrader drops.

domesticHauler: RCL 2-4. Local source to Spawn/Ext transport. Retires when Links deploy.

emergencyBuilder: Death spiral recovery. Ignores strict logistics, directly refills spawn.

Economy & Outposts

harvester: 1 per source. Zero-pathing execution. Halts based on ticksToRegeneration.

upgrader: Storage > 50k. Stationary. Upgrades via ground pickup or Link withdraw.

worker: RCL 1-2 multi-tool fallback. Replaced by dedicated roles.

remoteDefender: Paths to remotes, eliminates hostiles via heatmaps, avoids core defenders.

Sector Operations (SK & Power)

skMiner: Zero-pathing harvester for Source Keepers.

skGuard: Locks to lairs using heap-tracked spawn ticks.

skHauler: High-capacity hauler for SK sectors.

powerAttacker/Healer: Calculates and applies exact damage to Power Banks.

powerHauler: Dispatched precisely when bank HP reaches kill threshold.

Defense & Asymmetric

rampartMelee: DEFCON 3 or lower. Parks on choke-points. Swaps with backups at <30% HP.

decoy: Harassment. Parks on enemy sites to block builds. Kites defenders to waste CPU.

Siege & Offense

quadAttacker/Healer: Scheduled assaults. Atomic lockstep movement. Predictive pre-heals.

soloDismantler: HVT Dijkstra pathing to weakest walls. Ignores enemy creeps.

drainerHunter: Tower drain ops. Edges tower range, eats damage, heals, uses I-frame bouncing.

coreSniper: Blocks enemy controller upgrades to force downgrading.