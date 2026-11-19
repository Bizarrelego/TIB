# AGENTS.md (AI System Injection - Flat Functional Architecture)

### 1. Architectural Philosophy: Strict Flat Functional Design
* **Zero OOP Managers & Zero Classes:** Do not write classes, class hierarchies, or OOP manager abstractions. Write pure functions and lightweight POJO state dictionaries.
* **Consolidated 16-Module Architecture:** All runtime logic belongs exclusively to these 16 flat modules in `src/` (the exact set in `MODULE_EXPORTS_MAP`):
  - `src/main.js`: Main tick loop, RawMemory deserialization cache, CPU bucket guard, sandboxed phase scheduler.
  - `src/constants.js`: Shared integer constants, bitmasks, action enums, math utilities, hyperparameters.
  - `src/config.js`: Imperial settings schema, validated dot-path get/set, reset-safe hydration, console formatter.
  - `src/state.js`: Global state scanner, O(1) room caches, Virtual Ledger, memory cleanup, heap TypedArray pools, colony health.
  - `src/spawning.js`: Census calculations, spawn queues, sub-tick spawn ledger, creep body definitions, pre-spawn matrix.
  - `src/harvesters.js`: Stationary drop-mining, container/link mining, mineral extraction.
  - `src/logistics.js`: Top-down hauler matching, dropped/tombstone/container pulls, link beaming.
  - `src/workers.js`: Upgraders (controller range 3) and builders (single-site throttling).
  - `src/traffic.js`: Movement intents, DFS conflict resolution, idle shoving, working-area protection.
  - `src/bunker.js`: Distance-transform anchor, bunker/extension blueprints, container/tower/storage placement.
  - `src/roads.js`: Road network flood-fill/PathFinder planning with swamp avoidance.
  - `src/mincut.js`: Dinic max-flow min-cut rampart planning (bucket-gated).
  - `src/remotes.js`: Outpost scouting/scoring, reservers, remote miners/haulers, observer sweeps.
  - `src/labs_market.js`: Lab reaction DAG, boosts, terminal equalization, market trading.
  - `src/defense.js`: Tower focus-fire, healing, hysteresis rampart repair, power spawn.
  - `src/combat_quads.js`: 2x2 quad movement, cross-healing, kiting, siege.
  - (`src/creeps.js`, `src/structures.js`, `src/planner.js` are legacy re-export shims; never put new logic there.)

### 2. Core Execution Constraints
* **Heap Exclusivity:** Do not parse or mutate `Memory` inside tick loops. Use `creep.heap` for all operational data (`targetId`, `state`, `actionIntent`, `sleepUntil`). Use `creep.memory` strictly for immutable static strings (`role`, `colony`).
* **Zero Native Polling:** Never invoke `room.find()`, `room.lookAt()`, or `room.lookForAt()` inside per-creep tick loops. Creeps read exclusively from pre-scanned arrays or lookup dictionaries provided by `src/state.js`.
* **Fatigue Gating:** Every creep action execution function must immediately exit if the creep cannot move: `if (creep.fatigue > 0) return;`
* **CPU Sleep:** If a target source, mineral, or deposit is depleted, compute `Game.time + source.ticksToRegeneration`, store it in `creep.heap.sleepUntil`, and halt execution until that tick is reached.
* **RawMemory Interception:** Maintain global memory binding across ticks to eliminate persistent `JSON.parse(RawMemory.get())` overhead.

### 3. Pipeline Split (Stateless Muscle vs Pure Brain)
* **Muscle (`src/harvesters.js`, `src/logistics.js`, `src/workers.js`, `src/traffic.js`, `src/combat_quads.js`):** Creeps contain zero decision-making logic or room queries. Functions read `creep.heap.targetId` and `creep.heap.actionIntent`, execute the single corresponding native Screeps API call, and transition `creep.heap.state = 'idle'` upon completion or error.
* **Brain (`src/spawning.js`, `src/bunker.js`, `src/roads.js`, `src/remotes.js`):** Iterates over idle creeps, inspects pre-computed state from `src/state.js`, and assigns `targetId` and `actionIntent` directly to `creep.heap`.
* **Eyes (`src/state.js`):** Runs at the exact beginning of the tick. Parses visible room objects into flat O(1) structures and resets the per-tick Virtual Ledger.
* **Heart (`src/spawning.js`):** Manages spawning queues and energy allocations based on census definitions.

### 4. Foundation-First Curriculum
The orchestrator enforces a strict 5-stage gate: (1) heap/state/bootstrap/drop-mining/traffic, (2) base planning/roads/RCL 3-4, (3) links/remotes/mincut, (4) minerals/labs/terminal, (5) quads/siege/CPU. Never work on a later stage's module while an earlier stage's quantitative gate is unmet.
