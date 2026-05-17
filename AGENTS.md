# TIB Bot Architecture: Early Game Aggression & Efficiency

## 1. Core Execution & CPU Efficiency

Strict JS & JSDoc Mandate: .js only. Extensive JSDoc required for IDE intellisense.

Zero Native Polling: Remove room.find(), room.lookAt(). Rely exclusively on global.State and cache.

Event-Driven Radar: Parse room.getEventLog() for attacks or decay. Zero CPU wasted scanning grids.

Fatigue Gating: Instantly return and skip tick logic if fatigue > 0.

Source Sleep: Suspend creep execution until wakeTick (Game.time + source.ticksToRegeneration) if a source is empty.

Aggressive Tick Slicing: Sleep non-critical systems (e.g., evaluate spawns every 10 ticks) to maintain a sub-millisecond CPU floor.

Heap Exclusivity: Proxy memory to heap. creep.memory strictly for persistent data (role, colony). Operational data routes to creep.heap.

Global Reset Recovery: Detect VM resets and rehydrate global.Cache and O(1) dictionaries immediately to prevent ID lookup failures.

## 2. Early-Game Managers

OS/Memory Manager: Bypasses standard memory parse. Validates heap and builds O(1) entity dictionaries.

Intel Manager: Maps cross-room intel to RawMemory segments to bypass the 2MB parse limit. Feeds hostile data directly to the Combat Manager.

Colony Manager: Drives room-level progression. Hardcodes early RCL 1-3 layouts relative to Spawn to bypass matrix calculations during the bootstrap phase.

Spawn Manager: Utilizes a Sub-Tick Spawn Ledger to track room energy capacity, preventing multiple managers from queuing expensive creeps simultaneously and triggering engine rejections.

Logistics Manager: Executes top-down assignment. Managers evaluate state and assign targets directly to creeps in O(1) or O(N). Creeps never scan or "bid".

Traffic Manager: Issues opposite move intents to idle blocking creeps (Shoving) in 1-tile corridors. Injects custom CostMatrix in early RCL to heavily penalize swamp tiles, forcing creeps onto plains.

Combat Manager: Drives early game poaching, core sniping, and harassment routing.

## 3. Early Game Logistics & Economy

Containerless Mining: Drop remote energy on the ground. Dynamically size haulers to sweep before decay. Bypasses early container construction delays.

Zero-Pathing Stationary Harvesting: Calculate optimal mining spot once. Move there. Never invoke pathing algorithms again.

Static Upgrading: Haulers drop energy on the upgrader's exact tile. Upgraders execute pickup() + upgradeController().

Ruin Scavenging: Prioritize ruins/tombstones over harvesting to inject free energy directly into progression.

Batched Construction Throttling: Throttle active construction sites to 3 per room to prevent engine parsing lag while allowing concurrent builder execution.

## 4. Tigga-Style Early Aggression

Early Poaching: Dispatch fast attackers to kill neighbor remote harvesters and loot dropped energy.

Remote Denial: Park 150-energy decoys on enemy construction sites to kite defenders, waste their CPU, and starve their outposts.

Core Sniping: Block or kill upgraders in low RCL neighbor rooms to trigger controller downgrading and wipe local competition.

Tower Drain Ops: Deploy drainerHunter creeps to edge tower range, eat damage, heal, and step into adjacent rooms (I-frames) to drop aggro.

## 5. Early Phase Milestones (RCL 1-3)

RCL 1: Brute-force controller. 15 generic workers. Drop-mining. No structures.

RCL 2: 5 extensions near spawn. Strict role split (Harvester/Hauler). Initiate domestic hauling.

RCL 3: 1 Tower (Hostiles > Heals > Roads 10%). Central roads. Scale haulers. Launch Core Sniping operations.

## 6. Creep Dictionary (Early-Game Only)

worker: RCL 1-2 multi-tool fallback. Replaced immediately upon RCL 2.

harvester: 1 per source. Zero-pathing execution. Halts based on ticksToRegeneration.

domesticHauler: Local transport. Sweeps dropped energy.

upgrader: Stationary. Upgrades via ground pickup.

emergencyBuilder: Death spiral recovery. Ignores strict logistics, directly refills spawn.

decoy: Harassment. Parks on enemy sites to block builds. Kites defenders.

coreSniper: Blocks enemy controller upgrades to force downgrading.

drainerHunter: Tower drain ops. I-frame bouncing.