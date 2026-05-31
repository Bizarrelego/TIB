/**
 * The Brain - TaskAssignmentManager
 * Assigns deterministic intents to idle creeps reading strictly from global.State.
 */
const { getHash } = require('../utils/HashUtility');

function run(roomName) {
  if (!global.State || !global.State.rooms || !global.State.rooms.has(roomName)) return;

  const roomState = global.State.rooms.get(roomName);

  for (const name in Game.creeps) {
    const creep = Game.creeps[name];
    if (creep.memory.colony !== roomName) continue;

    // Safely initialize creep.heap
    if (!creep.heap) {
      creep.heap = { state: 'idle', targetId: null, actionIntent: null };
    }

    if (creep.heap.state === 'idle') {
      const role = creep.memory.role;

      if (role === 'harvester') {
        const sources = roomState.sources;
        if (sources && sources.length > 0) {
          const sourceCounts = new Map();
          sources.forEach(s => sourceCounts.set(s.id, 0));

          for (const cName in Game.creeps) {
            const c = Game.creeps[cName];
            if (c.memory.colony === roomName && c.memory.role === 'harvester' && c.heap && c.heap.targetId) {
              if (sourceCounts.has(c.heap.targetId)) {
                sourceCounts.set(c.heap.targetId, sourceCounts.get(c.heap.targetId) + 1);
              }
            }
          }

          const bestSource = sources.reduce((a, b) => sourceCounts.get(a.id) < sourceCounts.get(b.id) ? a : b);
          creep.heap.targetId = bestSource.id;
          creep.heap.actionIntent = 'harvest';
          creep.heap.state = 'working';
        }
      } else if (role === 'hauler') {
        if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
          // Hauler is empty, needs to pick up energy
          let target = null;
          let intent = null;

          const validRuins = (roomState.ruins || []).filter(r => r.store && r.store.getUsedCapacity(RESOURCE_ENERGY) > 0);
          const validTombstones = (roomState.tombstones || []).filter(t => t.store && t.store.getUsedCapacity(RESOURCE_ENERGY) > 0);
          const validDrops = (roomState.droppedEnergy || []).filter(d => d.amount > 0);

          if (validRuins.length > 0) {
            const index = getHash(name, validRuins.length);
            target = validRuins[index];
            intent = 'withdraw';
          } else if (validTombstones.length > 0) {
            const index = getHash(name, validTombstones.length);
            target = validTombstones[index];
            intent = 'withdraw';
          } else if (validDrops.length > 0) {
            const index = getHash(name, validDrops.length);
            target = validDrops[index];
            intent = 'pickup';
          }

          if (target) {
            creep.heap.targetId = target.id;
            creep.heap.actionIntent = intent;
            creep.heap.state = 'working';
          }
        } else {
          // Hauler has energy, needs to deliver
          let target = null;
          let intent = null;

          if (roomState.spawns && roomState.spawns.length > 0) {
            const spawn = roomState.spawns[0];
            if (spawn.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
              target = spawn;
              intent = 'transfer';
            }
          }

          if (!target) {
            const upgraders = [];
            for (const cName in Game.creeps) {
              const c = Game.creeps[cName];
              if (c.memory.colony === roomName && c.memory.role === 'upgrader') {
                upgraders.push(c);
              }
            }
            if (upgraders.length > 0) {
              const index = getHash(name, upgraders.length);
              target = upgraders[index];
              intent = 'drop'; // drop near the upgrader
            } else if (roomState.controller) {
              target = roomState.controller;
              intent = 'drop';
            }
          }

          if (target) {
            creep.heap.targetId = target.id;
            creep.heap.actionIntent = intent;
            creep.heap.state = 'working';
          }
        }
      } else if (role === 'upgrader') {
        const controller = roomState.controller;
        if (controller) {
          creep.heap.targetId = controller.id;
          creep.heap.actionIntent = 'upgrade';
          creep.heap.state = 'working';
        }
      }
    }

    // Runtime verification
    if (creep.heap && creep.heap.actionIntent) {
      console.log(`[Task Check] ${creep.name} | Intent: ${creep.heap.actionIntent} | TargetID: ${creep.heap.targetId}`);
    }
  }
}

module.exports = {
  run
};
