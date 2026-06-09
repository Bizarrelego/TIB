# AGENTS.md (AI System Injection)

### 1. AI Behavioral Directives
* **Single Responsibility:** Write exactly the module or function requested. Do not anticipate future requirements. 
* **Zero Placeholders:** Never use `// TODO`, `// Implementation placeholder`, or partial logic. Write complete, functional code blocks.
* **Pure Utility Functions:** Utility functions must return data. They must never mutate `Memory`, `global`, or `creep.heap` directly unless explicitly commanded.

### 2. Core Execution Constraints
* **Heap Exclusivity:** Do not parse `Memory` in tick loops. Use `creep.heap` for all operational data (`targetId`, `state`, `actionIntent`). Use `creep.memory` strictly for static strings (`role`, `colony`).
* **Zero Native Polling:** Do not use `room.find()`, `room.lookAt()`, or `room.lookForAt()` inside creep tick loops. Read from the global state object.
* **Fatigue Gating:** Every creep loop must start with: `if (creep.fatigue > 0) return;`
* **CPU Sleep:** If a target source is empty, calculate `Game.time + source.ticksToRegeneration`, store it in the creep's heap, and halt execution until that tick.

### 3. Skeleton Top-Down Architecture Constraints
The architecture must scale. Enforce this strict Brain/Muscle split:
* **The Muscle (Roles):** Creep role files MUST NOT contain logic, `find()`, or targeting decisions. Roles only read `creep.heap.targetId` and `creep.heap.actionIntent` and execute the native API call. If an action fails or completes, the creep sets `creep.heap.state = 'idle'`.
* **The Brain (`TaskAssignmentManager`):** This manager iterates over idle creeps, evaluates the central state, and writes the `targetId` and `actionIntent` to the creep's heap.
* **The Eyes (`GlobalStateScanner`):** Runs at the start of the tick. Parses structures, sources, and drops into O(1) arrays/dictionaries. Managers pull data exclusively from here.
* **The Heart (`SpawnManager`):** Spawns creeps based on a hardcoded integer census limit. Do not use dynamic math for limits in this phase.