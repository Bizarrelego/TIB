TIB Bot Architecture & Coding Standards
1. Core CPU & Execution Principles
Zero Native Polling: Never use room.find(), room.lookAt(), or room.lookForAt() inside tick loops. Query pre-scanned maps in global.State.

Event-Driven Updates: Rely on room.getEventLog() to update state (e.g., detecting attacks or destroyed structures) rather than iterating arrays.

Fatigue Gating: If a creep has fatigue > 0, instantly return and skip all logic for that tick. Movement logic on fatigued creeps wastes CPU.

Source Sleep: If a source is empty, set a wakeTick in the creep's heap equal to Game.time + source.ticksToRegeneration and halt execution until that tick.

Intent Maximization: Stack non-conflicting intents (e.g., move(), transfer(), rangedHeal()) in the same tick. Do not wait for one intent to resolve to execute another.

Aggressive Tick Slicing: Stagger non-critical systems based on CPU limits. Run traffic every tick, but spawn and economy logic can sleep (e.g., Game.time % 10 === 0).

Cascading CPU Throttling: Use hardcoded switch statements to cut non-essential operations (upgrades, remotes) when the bucket drops below critical thresholds (e.g., 5000, 1000). Priority goes to survival (Defense, Logistics).

2. Memory & State Management
Heap Exclusivity: Proxy memory to the heap. The native creep.memory must ONLY contain minimal persistent data (role, colony). Write all operational data to creep.heap.

V8 Map Optimization: Use Map() for all O(1) lookups and large dictionaries, never plain {} objects. Utilize structuredClone() for deep copies.

Error Boundaries: Wrap every Manager function in an isolated try/catch block. A single unhandled exception must never halt the entire Node.js loop.

Memory Segmentation: Bypass the 2MB standard memory cap by mapping cross-room intel and heatmaps to RawMemory segments (e.g., 0-10 for Intel, 11-20 for Transforms).

Heap Rehydration: Explicitly detect server global resets. If global.Cache is wiped, immediately reconstruct critical O(1) dictionaries before running phase logic.

3. Logistics, Economy & Movement
Sub-Tick Ledger: Use a virtual ledger in the Traffic Manager to register all resource transfers, drops, and pickups to prevent API execution waste (e.g., ERR_NOT_ENOUGH_RESOURCES).

Top-Down Assignment: Creeps never scan for jobs. Managers assess the room state, pop the highest urgency task, and assign targets directly to creeps in O(1) or O(N).

Spawn Validation: Managers must check SpawnLedger to ensure sub-tick energy availability before queueing a spawn.

Zero-Pathing Stationary Harvesting: Harvesters calculate the optimal mining spot once, walk there, and never invoke pathing algorithms again.

Static Upgrading: Upgraders never move. Haulers drop energy on the upgrader's exact tile, allowing simultaneous pickup() and upgradeController().

Containerless Remote Mining: Drop remote energy on the ground. Dynamically size haulers to sweep it before decay to save 250k energy in container repairs over a room's lifespan.

Simultaneous Swarm Swapping (Shoving): Implement shove logic. If Creep A moves into Creep B, and B is idle, issue an opposite move intent to B so both pass in one tick.

Train Hauling: Decouple payload from movement on highways. Use a pure-MOVE engine to pull a 0-MOVE cart (engine.pull(cart), cart.move(engine)).

4. Base Defense & Planning
Single-Site Construction: Throttle site placement. Only place the next highest priority construction site after the current one is finished to prevent builder fatigue bouncing and native engine parsing lag.

Hardcoded Offset Stamps: Bypass DistanceTransform matrices at early RCLs. Hardcode RCL 1-4 layouts relative to the primary Spawn's coordinates to save CPU.

Min-Cut Ramparts: Generate DistanceTransform grids and apply Ford-Fulkerson to block choke points. Never manually place ramparts or blanket the outer wall.

DEFCON State Machine: Strictly dictate base behavior based on threat level. (e.g., DEFCON 2: Halt upgrades, dump storage into ramparts; DEFCON 1: Trigger Safe Mode).

Rampart Dancing: Rotate low-HP melee defenders off choke-point ramparts with idle backups using TrafficManager.registerSwap() to multiply effective defense HP.

5. Combat & Siege Execution
Dynamic Body Calculus: Never hardcode transport/mining bodies. Mathematically calculate exact body arrays based on distance and energy potential.

Atomic Quad Movement: Force quads to move as a single entity using chain-pulling. If one lags due to fatigue, the entire block waits, preventing piecemeal wipes.

Predictive Pre-Healing: Calculate enemy tower targeting logic and apply heal() on the same tick damage is received. Do not wait for health to drop.

Border Bouncing (I-Frames): Exploit 1-tick room transitions. Step into adjacent rooms to drop aggro, dodge slow projectiles, and heal safely before stepping back.

Synchronized Burst Fire: Force attackers to hold fire until all members are ready, then hit the target on the exact same tick to out-pace sustained tower healing.

6. Phase Milestones (RCL)
RCL 1 (Bootstrap): Brute-force the controller (0-200 Energy). Spawn up to 15 generic [WORK, CARRY, MOVE] workers. Do not build roads or structures. Use drop-mining.

RCL 2 (Core Infrastructure): Transition to Harvesters (stationary) and Haulers. Build 5 extensions directly adjacent to spawn. Prioritize extensions, dump overflow in a controller container.

RCL 3 (Defense): Build 1 Tower and central roads. Tower logic targets Hostiles > Heals > Roads at 10% HP. Scale haulers to leverage road speed bonuses.

RCL 4 (Storage): Build Storage as a permanent buffer. Deploy remote defenders and harvesters to 1-2 adjacent rooms. Introduce fastFiller to pull from Storage.

RCL 5 (Links): Build 2 Links (Source to Hub). Retire domestic haulers for that source. Deploy a stationary hubManager to move energy from the hub Link to Storage.

RCL 6 (Market & Minerals): Build Terminal and Extractor. Activate Exponential Moving Average (EMA) market pricing with Interquartile Range (IQR) outlier filtering to auto-trade.

RCL 7 (Industry): Build 2nd Spawn and Factory. Compress surplus energy into batteries. Use a 4th Link to beam energy directly to the controller upgrader. Begin T2 boosts.

RCL 8 (Empire): Build 3rd Spawn, Power Spawn, Observer, and Nuker. Complete Lab array for T3 boosts. Launch automated claim and military ops.

7. Agent/Role Directory
Logistics
fastFiller: Stationary micro-hub filler (Storage -> Spawns/Extensions).

hubManager: Transfers energy between central structures (Links, Storage, Terminal).

hauler: Primary energy transport.

domesticHauler: Early-RCL localized transport.

Economy & Outposts
harvester: Stationary source miner. Zero-pathing execution.

upgrader: Stationary controller booster.

worker: RCL 1-2 generic multi-tool.

reservationGuard / remoteDefender: Protects outposts from invaders and player harassment.

Defense
rampartMelee: Cycles choke points to halt breaches.

rampartRanged: Kites killboxes.

Strategic Offense
quadAttacker / quadHealer: Atomic 4-creep siege blocks.

drainerHunter: Edges tower ranges to bleed enemy energy reserves.

soloDismantler: HVT Dijkstra pathing block-breaker.

coreSniper: Parks on low-RCL enemy controllers to force downgrades.

Asymmetric Warfare & Early Offense
decoy: Naked 50-energy creep that permanently blocks neighbor construction sites.

highwayPatrol: Intercepts unguarded logistics.

hostileStorageLooter: Cleans up dropped energy from poached remotes.

SK & Power Ops
skMiner / skGuard / skHauler: Timed lair exploitation.

powerAttacker / powerHealer / powerHauler: High-burst bank cracking.

Expansion & Operations
claimer / pioneerHarvester / pioneerQueen: Automated room claiming when bucket exceeds 9000.

mineralMiner: Extractor automation.

emergencyBuilder: MVC (Minimal Viable Creep) for Death Spiral recovery.

engine / cart: Decoupled train units.