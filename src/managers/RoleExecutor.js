const ActionConstants = require('../constants/ActionConstants');
const CreepHeapUtility = require('../utilities/CreepHeapUtility');

const roles = { /* Map roles to their respective logic modules */
    'harvester': require('../roles/Harvester'),
    'hauler': require('../roles/Hauler'),
    'upgrader': require('../roles/Upgrader'),
    'builder': require('../roles/Builder')
};

/**
 * Top-Down Role Executor
 * Processes intent execution based on heap-stored actions.
 */
class RoleExecutor {
    static run() {
        if (!global.creepHeap) global.creepHeap = new Map();
        
        // Check: Object.values is faster than Object.keys followed by property lookup.
        const creeps = Object.values(Game.creeps);
        
        for (let i = 0; i < creeps.length; i++) {
            const creep = creeps[i];
            
            if (creep.spawning || creep.fatigue > 0) continue;

            let heap = global.creepHeap.get(creep.name);
            if (!heap) {
                heap = CreepHeapUtility.getDefaultHeap();
                heap.sleepUntil = 0;
                global.creepHeap.set(creep.name, heap);
            }
            creep.heap = heap;

            if (Game.time < creep.heap.sleepUntil) continue;

            const actionIntent = creep.heap.actionIntent;

            if (!actionIntent || actionIntent === ActionConstants.ACTION_IDLE) continue;

            if (actionIntent === ActionConstants.ACTION_SCOUT || actionIntent === ActionConstants.ACTION_MOVE_ROOM) {
                RoleExecutor.executeCrossRoomTask(creep);
                continue;
            }

            const roleLogic = roles[creep.memory.role]; // Retrieve role logic dynamically
            if (roleLogic) {
                roleLogic.run(creep); // Execute role logic
            } else {
                creep.heap.state = 'idle';
                creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
            }
        }
    }

    static executeCrossRoomTask(creep) {
        const targetRoom = creep.memory.targetRoom;
        if (!targetRoom) {
            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
            return;
        }

        if (creep.room.name !== targetRoom) {
            const moveResult = creep.moveTo(new RoomPosition(25, 25, targetRoom), { 
                range: 20, 
                reusePath: 50, 
                maxOps: 1000,
                visualizePathStyle: { stroke: '#00ff00' } 
            });

            if (moveResult === ERR_NO_PATH) {
                creep.memory.targetRoom = null;
                creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
            }
        } else {
            if (creep.pos.x === 0 || creep.pos.x === 49 || creep.pos.y === 0 || creep.pos.y === 49) {
                creep.moveTo(new RoomPosition(25, 25, creep.room.name), { reusePath: 10, ignoreCreeps: true });
            } else {
                creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
            }
        }
    }
}

module.exports = RoleExecutor;
