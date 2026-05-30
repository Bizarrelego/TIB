# AGENTS.md (Jules AI System Injection)

### 1. AI Behavioral Directives
* **Single Responsibility:** Write exactly the module or function requested. Do not anticipate future requirements. 
* **Zero Placeholders:** Never use `// TODO`, `// Implementation placeholder`, or partial logic. Write complete, functional code blocks.
* **No Ghost Features:** Do not include logic for links, containers, towers, or roads. The current architecture strictly prohibits them.
* **Pure Utility Functions:** Utility functions must return data. They must never mutate `Memory`, `global`, or `creep.heap` directly unless explicitly commanded.

### 2. Core Execution Constraints
* **Heap Exclusivity:** Do not parse `Memory` in tick loops. Use `creep.heap` for all operational data (`targetId`, `state`, `actionIntent`). Use `creep.memory` strictly for static strings (`role`, `colony`).
* **Zero Native Polling:** Do not use `room.find()`, `room.lookAt()`, or `room.lookForAt()` inside creep tick loops. Read from the global state object.
* **Fatigue Gating:** Every creep loop must start with: `if (creep.fatigue > 0) return;`
* **CPU Sleep:** If a target source is empty, calculate `Game.time + source.ticksToRegeneration`, store it in the creep's heap, and halt execution until that tick.

### 3. Skeleton Top-Down Architecture Constraints
The architecture must scale, but the current logic must remain primitive. Enforce this strict Brain/Muscle split:
* **The Muscle (Roles):** Creep role files MUST NOT contain logic, `find()`, or targeting decisions. Roles only read `creep.heap.targetId` and `creep.heap.actionIntent` and execute the native API call. If an action fails or completes, the creep sets `creep.heap.state = 'idle'`.
* **The Brain (`TaskAssignmentManager`):** This manager iterates over idle creeps, evaluates the central state, and writes the `targetId` and `actionIntent` to the creep's heap.
* **The Eyes (`GlobalStateScanner`):** Runs at the start of the tick. Parses structures, sources, and drops into O(1) arrays/dictionaries. Managers pull data exclusively from here.
* **The Heart (`SpawnManager`):** Spawns creeps based on a hardcoded integer census limit. Do not use dynamic math for limits in this phase.

### 4. Active Phase: RCL 1-2 Bootstrapping
You are building a brute-force, high-efficiency early game. 
* **Logistics:** Implement strict Drop-Mining. Miners move to an optimal coordinate, lock their position, and execute `harvest()`. They do not path again. They let the engine drop excess energy.
* **Hauling:** Haulers use hashed assignments to target specific miners, preventing swarming. They sweep dropped energy and route strictly to the Spawn or Upgrader drop-pile.
* **Upgrading:** Upgraders are stationary. Haulers drop energy on the upgrader's exact tile. Upgraders execute `pickup()` and `upgradeController()` on the same tick.
* **Scavenging:** The `TaskAssignmentManager` must prioritize assigning `withdraw()` on `Ruin` and `Tombstone` objects over standard drop-piles.

### 5. BANNED ARCHITECTURE (Do Not Implement)
If you attempt to write code for any of the following, the request will be rejected. You are explicitly forbidden from generating:
* CostMatrix generation, distance transforms, or dynamic pathing algorithms (use direct engine `moveTo` only).
* Traffic Managers, deadlock resolution, or shoving algorithms.
* Combat squads, quads, or healing logic.
* Storage, Terminals, or Link routing.
* Dynamic creep body calculations (use hardcoded arrays like `[WORK, CARRY, MOVE, MOVE]`).