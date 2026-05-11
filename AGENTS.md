# TIB Bot Architecture & Coding Standards

## Core Principles
- **O(1) Priority**: Never use `room.find()` or `room.lookAt()` inside loops. Use the pre-scanned maps in `global.State`.
- **CPU Throttling**: All modules must respect the `Game.cpu.bucket` thresholds defined in `main.js`.
- **Memory Management**: Use the `heap` proxy for all non-essential data. Only store `role` and `colony` in permanent `Memory`.
- **Movement**: Never use `creep.moveTo()`. Always use the `movement.moveTo()` wrapper in `src/utils/`.

## Room Phases
1. **RCL 1**: Focus on 15 generic workers to brute-force the controller.
2. **RCL 2**: Transition to 2 Harvesters and 4 Haulers. Use static harvesting (harvesters drop energy on the ground).
3. **RCL 3+**: Implement tower defense and road networking.

## Implementation Rules
- Haulers must prioritize Spawns and Extensions. If full, they must drop energy at the Controller for workers.
- Harvesters must be assigned to a specific Source ID and stay there.
- Use the `VirtualLedger` in `trafficManager.js` to track resource intents and prevent wasted CPU on failed withdraws.