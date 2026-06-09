const ActionConstants = require('../constants/ActionConstants');
const CreepHeapUtility = require('../utilities/CreepHeapUtility');

const roles = Object.create(null);
roles['harvester'] = require('../roles/Harvester');
roles['hauler'] = require('../roles/Hauler');
roles['upgrader'] = require('../roles/Upgrader');
roles['builder'] = require('../roles/Builder');
roles['scavenger'] = require('../roles/Scavenger');
roles['bootstrapper'] = require('../roles/Bootstrapper');
roles['filler'] = require('../roles/Filler');
roles['scout'] = require('../roles/Scout');
roles['repairman'] = require('../roles/Repairman');
roles['defender'] = require('../roles/Defender');
roles['meleeCreep'] = require('../roles/MeleeCreep');
roles['rangerCreep'] = require('../roles/RangerCreep');
roles['medicCreep'] = require('../roles/MedicCreep');

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
                global.creepHeap.set(creep.name, heap);
            }
            creep.heap = heap;

            if (Game.time < creep.heap.sleepUntil) continue;

            const actionIntent = creep.heap.actionIntent;

            if (!actionIntent || actionIntent === ActionConstants.ACTION_IDLE) continue;

            if (actionIntent === ActionConstants.ACTION_MOVE_ROOM) {
                RoleExecutor.executeCrossRoomTask(creep);
                continue;
            }

            const roleLogic = roles[(creep.memory.role || '').toLowerCase()]; // Retrieve role logic
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
            creep.heap.destination = { x: 25, y: 25, roomName: targetRoom, range: 20 };
        } else {
            if (creep.pos.x <= 0 || creep.pos.x >= 49 || creep.pos.y <= 0 || creep.pos.y >= 49) {
                creep.heap.destination = { x: 25, y: 25, roomName: creep.room.name, range: 20 };
            } else {
                creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
            }
        }
    }
}

module.exports = RoleExecutor;
