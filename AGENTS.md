# TIB Early Game Progression Matrix (RCL 1-4)

## RCL 1: Bootstrap & Reconnaissance

Objective: Reach RCL 2 immediately. Map the surrounding sector.

Spawning: Brute-force generic worker creeps ([WORK, CARRY, MOVE]). Cap the spawn queue based on exact source energy throughput, not an arbitrary static limit.

Logistics: Zero pathing after arrival. Workers move to the source, harvest, and drop energy. Dedicated upgraders pick up and immediately apply it to the controller. No containers, no road construction.

State Initialization: JavaScript memory proxies spin up. Parse the room grid exactly once to build O(1) dictionaries. Cache source and controller IDs to heap.

Aggression: Deploy a single [MOVE] scout to map adjacent rooms. Identify vulnerable neighbors for future starving.

## RCL 2: Role Decoupling & Site Denial

Objective: Stabilize economy. Block neighbor expansion.

Infrastructure: Plop 5 extensions using a hardcoded coordinate stamp relative to the Spawn. Bypass expensive 15-CPU layout matrices entirely.

Logistics: Strict role split. harvester locks to the optimal mining tile and drops energy. domesticHauler sweeps dropped energy to fill the Spawn and extensions.

State Management: Multi-room operating system architecture initializes. Track neighbor room states via RawMemory segments.

Aggression: Dispatch decoy creeps ([MOVE], holding minimal energy) to sit directly on top of enemy construction sites in adjacent rooms. This blocks their builds and wastes their CPU and energy if they spawn defenders to clear the site.

## RCL 3: Tower Deployment & Core Sniping

Objective: Secure domestic infrastructure. Choke local competition.

Infrastructure: Build 1 Tower. Build roads strictly on swamp tiles first to maximize fatigue reduction per energy spent, then connect plains.

Defense: Tower logic strictly prioritized: Hostile Healers > Hostile Attackers > Creep Healing > Structure Repair (capped at 10% max hits to save energy).

Aggression: Execute Core Sniping. Target neighbor rooms still at RCL 1 or 2. Park a coreSniper ([ATTACK, MOVE]) directly on their controller to block upgrades and force a controller downgrade. If they deploy a tower, launch a drainerHunter ([TOUGH, HEAL, MOVE]) to ride the room border, soaking and healing damage to empty their energy reserves.

## RCL 4: Hub Logistics & Remote Poaching

Objective: Centralize economy. Exploit remote sectors.

Infrastructure: Construct Storage. This fundamentally alters the JS logistics pipeline. All local and remote energy now flows into Storage before distribution to Spawns or Upgraders.

Remote Mining: Claim 1-2 adjacent rooms. Harvesters drop-mine. High-capacity haulers sweep the dropped energy back to domestic Storage.

Aggression: Early Poaching. Dispatch fast attackers to neighboring remote mining operations. Kill their harvesters. Reroute your haulers to loot the dropped energy and transport it back to your Storage.