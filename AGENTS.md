TIB Bot Architecture & Coding Standards (Tigga-Style)
1. Core CPU & Execution Principles
Strict Token Limits: Max 150 lines per OS manager or role. Fragment larger logic. Exception: Pure algorithmic utilities (Min-Cut, Wasm bindings).
Strict JS & JSDoc Mandate: .js only. Extensive JSDoc (@param, @typedef, @returns) is mandatory for IDE intellisense and structural integrity.
Zero Native Polling: No room.find(), room.lookAt(), or room.lookForAt() in tick loops. Use global.State.
Event-Driven Updates (0-CPU Radar): Parse room.getEventLog() for attacks, structure decay, or construction.
Fatigue Gating: Instantly return and skip tick logic if fatigue > 0.
Source Sleep: Sleep execution until wakeTick (Game.time + source.ticksToRegeneration) if a source is empty.
Intent Maximization & Pipeline Locking: Stack non-conflicting intents. Lock pipelines (Movement, Melee, Ranged, Utility) via memory proxy to prevent engine overwrites.
Aggressive Tick Slicing: Sleep non-critical systems (e.g., evaluate spawns every 10 ticks).
Cascading CPU Throttling: Hardcoded switch statements cut operations based on bucket limits (e.g., 5k, 1k). Run Game.cpu.generatePixel() exactly at 10k bucket.
CostMatrix Caching: Generate once, serialize to heap, rebuild only on relevant getEventLog triggers.
Custom Profiler: Wrap managers in a sub-millisecond profiler tracking 1000-tick averages. No public packages.
Wasm Scaffolding: Compile WebAssembly (Rust/C++) for heavy algorithms (Min-Cut, Distance Transforms).
2. Memory & OS Management
Heap Exclusivity: Proxy memory to heap. creep.memory strictly for persistent data (role, colony). Operational data goes to creep.heap.
V8 Map Optimization: Use Map() for O(1) lookups. Deep copies via structuredClone().
Aggressive GC: Run every 100 ticks. Purge dead creeps from Memory.creeps and stale intel from RawMemory.
Error Boundaries: Wrap managers in isolated try/catch blocks to prevent loop halts.
Memory Segmentation: Map cross-room intel and heatmaps to RawMemory segments (e.g., 0-10 Intel, 11-20 Transforms).
Heap Rehydration: Reconstruct O(1) dictionaries instantly upon server global reset.
Event Bus (PubSub): Subsystems subscribe to events (e.g., EventBus.publish('HOSTILE_SPOTTED')).
3. Logistics, Economy & Pathing
Sub-Tick Ledger: Virtual ledger in Traffic Manager registers resource transfers to block execution waste.
Top-Down Assignment: Managers evaluate state and assign targets directly to creeps in O(1) or O(N). Creeps never scan.
Centralized Spawn Queues: Push requests to a prioritized queue (e.g., Harvesters [100] > Fillers [90] > Upgraders [10]).
Containerless Mining: Drop remote energy on the ground. Dynamically size haulers to sweep before decay.
Simultaneous Swapping: Traffic Manager issues opposite intents to idle blocking creeps.
Deadlock Resolution: DFS algorithm detects and breaks cyclic move intent gridlocks.
Static Upgrading: Haulers drop energy on the upgrader's exact tile. Upgraders execute pickup() + upgradeController().
Distance Transforms: Pre-calculate Spawn-to-Source tick distances once per discovered room.
Train Hauling: Decouple payload. Pure MOVE engine pulls pure CARRY cart.
4. Base Defense & Planning
Batched Construction: Max 5 active sites per room to prevent engine parsing lag.
Min-Cut Ramparts: Ford-Fulkerson applied to DistanceTransform grids for automated choke-point blocking.
Dynamic Heatmaps: Range 3 penalty tiles applied to standard CostMatrices around hostiles for auto-kiting.
DEFCON State Machine: Dictate base behavior via threat tier (e.g., DEFCON 2: Halt upgrades, dump storage into ramparts).
Rampart Dancing: Traffic Manager swaps low-HP defenders with idle backups on choke-points.
Active Killbox Funneling: Unramparted, tower-surrounded paths designed to bait and concentrate fire on hostiles.
5. Combat & Siege Execution
Dynamic Body Calculus: Mathematically generate exact body arrays based on route distance and target energy.
Atomic Quad Movement: 4-creep lockstep chain-pulling. If one halts, the entire quad waits.
Predictive Pre-Healing: Assess enemy tower target logic and heal() on the same tick damage connects.
Border Bouncing (I-Frames): Step into adjacent rooms to drop aggro and heal.
Synchronized Burst Fire: Attackers hold fire until ready, hitting the target on the exact same tick.
HVT Dijkstra Penetration: Calculate cheapest path through rampart segments to eliminate High-Value Targets.
6. Asymmetric Warfare & Meta-Game
Early Poaching: Kill remote harvesters and loot dropped energy from weak neighbors.
Remote Denial: Park 150-energy decoys on enemy construction sites to kite defenders and starve outposts.
Market Arbitrage: Execute trades only if the market spread exceeds transfer costs.
Market Outliers: Apply Interquartile Range (IQR) filtering before calculating EMA to reject 1-unit bait orders.
7. Phase Milestones (RCL)
RCL 1: Brute-force controller. 15 generic workers. Drop-mining. No structures.
RCL 2: 5 extensions near spawn. Source/Controller containers. Role split (Harvester/Hauler).
RCL 3: 1 Tower (Hostiles > Heals > Roads 10%). Central roads. Scale haulers.
RCL 4: Storage buffer. Hub logistics begin. Deploy remote mining to 1-2 rooms.
RCL 5: 2 Links (Source-to-Hub). Retire domestic haulers for linked sources.
RCL 6: Terminal & Extractor. EMA market scripts online. 3 Labs.
RCL 7: 2nd Spawn & Factory. Compress surplus into batteries. 4th Link to Upgrader.
RCL 8: 3rd Spawn, Power Spawn, Observer, Nuker. 10 Labs. Auto-claim operations launch.
8. Creep Dictionary & Role Schematics
Logistics & Infrastructure
fastFiller
Spawn Condition: RCL 4+, Storage, min 2
Body Priority: 1:1 CARRY:MOVE (Max 50)
Core Behavior: Stationary micro-hub. Pulls from Storage/Link, fills adjacent Spawns/Exts.
hubManager
Spawn Condition: RCL 5+, Links online, exactly 1
Body Priority: 16 CARRY, 1 MOVE
Core Behavior: Parks between Hub Link, Storage, Terminal. Sub-tick ledger transfers.
hauler
Spawn Condition: Remote mining active
Body Priority: Math 2:1 CARRY:MOVE
Core Behavior: Sweeps dropped energy/ruins/tombstones. Fills storage or upgrader drops.
domesticHauler
Spawn Condition: RCL 2-4 (Pre-Links)
Body Priority: Max CARRY:MOVE (up to 600)
Core Behavior: Local source to Spawn/Ext transport. Retires when source Links deploy.
Economy & Outposts
harvester
Spawn Condition: 1 per local source
Body Priority: Max 5-7 WORK, 1 CARRY/MOVE
Core Behavior: Moves to optimal tile, drops energy. Halts based on ticksToRegeneration.
upgrader
Spawn Condition: Storage > 50k, or downgrade
Body Priority: Max WORK, 1-2 CARRY, min MOVE
Core Behavior: Stationary. Upgrades via ground pickup() or Controller Link withdraw().
worker
Spawn Condition: RCL 1-2, or active sites
Body Priority: 1:1:1 WORK:CARRY:MOVE
Core Behavior: Multi-tool fallback (Harvest/Build/Upgrade). Replaced by dedicated roles.
remoteDefender
Spawn Condition: Hostiles in remote room
Body Priority: RANGED_ATTACK + HEAL
Core Behavior: Paths to remotes, eliminates hostiles via heatmaps, avoids core defenders.
Defense & Asymmetric
rampartMelee
Spawn Condition: DEFCON 3 or lower
Body Priority: Max ATTACK, heavy MOVE
Core Behavior: Parks on choke-points. Swaps with backups at <30% HP. Range 1 targeting.
decoy
Spawn Condition: Harassment targeted
Body Priority: 1 MOVE (50e)
Core Behavior: Parks on enemy sites to block builds. Kites defenders to waste CPU.
emergencyBuilder
Spawn Condition: Death Spiral (0e, empty spawn)
Body Priority: 1 WORK:CARRY:MOVE (200e)
Core Behavior: Ignores all standard logic. Mines nearest node, directly refills spawn.
Siege & Offense
quadAttacker/Healer
Spawn Condition: Scheduled assault
Body Priority: Dense array vs tower count
Core Behavior: Atomic lockstep movement. Predictive pre-heals incoming damage.
soloDismantler
Spawn Condition: Core penetration needed
Body Priority: Max WORK, max MOVE
Core Behavior: HVT Dijkstra pathing to weakest wall segments. Ignores enemy creeps.
drainerHunter
Spawn Condition: Tower drain op
Body Priority: Max HEAL, max MOVE, TOUGH
Core Behavior: Steps 1 tile into tower range, eats damage, heals, uses I-frame bouncing.
