const Harvester = require('./../roles/Harvester');
const Hauler = require('./../roles/Hauler');
const Upgrader = require('./../roles/Upgrader');
const Builder = require('./../roles/Builder');

class TaskAssignmentManager {
    static run() {
        if (!(global.creepHeap instanceof Map)) global.creepHeap = new Map();
        if (!global.Tick) global.Tick = {};
        
        // Separate claims for gathering (pulling energy) and delivering (pushing energy)
        global.Tick.gatherClaims = new Map();
        global.Tick.deliveryClaims = new Map();

        const creepNames = Object.keys(Game.creeps);
        
        for (let i = 0; i < creepNames.length; i++) {
            const creep = Game.creeps[creepNames[i]];
            
            const roomObj = Game.rooms[creep.memory.room || creep.room.name];
            if (!roomObj) continue;

            const roomState = global.State?.rooms?.get(roomObj.name);
            if (!roomState) continue; // Abort if GlobalStateScanner has not processed the room

            if (!global.creepHeap.has(creep.name)) {
                global.creepHeap.set(creep.name, { state: 'idle', actionIntent: 'idle', targetId: null, secondaryTargetId: null });
            }
            creep.heap = global.creepHeap.get(creep.name);

            if (creep.heap.actionIntent !== 'idle' && creep.heap.actionIntent !== null) {
                TaskAssignmentManager.validateCurrentTask(creep, roomState);
                
                // If task remains valid after check, re-register claims and skip reassignment
                if (creep.heap.actionIntent !== 'idle') {
                    TaskAssignmentManager.reregisterClaim(creep);
                    continue; 
                }
            }

            TaskAssignmentManager.updateCreepState(creep);
            TaskAssignmentManager.assignTask(creep, roomState);
        }
    }

    static reregisterClaim(creep) {
        if (!creep.heap.targetId) return;
        if (creep.heap.state === 'gather') {
            global.Tick.gatherClaims.set(creep.heap.targetId, (global.Tick.gatherClaims.get(creep.heap.targetId) || 0) + creep.store.getFreeCapacity());
        } else if (creep.heap.state === 'work' && (creep.heap.actionIntent === 'transfer' || creep.heap.actionIntent === 'build')) {
            global.Tick.deliveryClaims.set(creep.heap.targetId, (global.Tick.deliveryClaims.get(creep.heap.targetId) || 0) + creep.store.getUsedCapacity(RESOURCE_ENERGY));
        }
    }

    static updateCreepState(creep) {
        const used = creep.store.getUsedCapacity(RESOURCE_ENERGY);
        const free = creep.store.getFreeCapacity(RESOURCE_ENERGY);

        if (!creep.heap.state || creep.heap.state === 'idle') {
            creep.heap.state = 'gather';
        }

        if (creep.heap.state === 'gather' && free === 0) {
            creep.heap.state = 'work';
            creep.heap.targetId = null; 
        } else if (creep.heap.state === 'work' && used === 0) {
            creep.heap.state = 'gather';
            creep.heap.targetId = null; 
        }
    }

    static validateCurrentTask(creep, roomState) {
        if (!creep.heap.targetId) return;
        const target = Game.getObjectById(creep.heap.targetId);
        
        if (!target) {
            creep.heap.targetId = null;
            creep.heap.actionIntent = 'idle';
            return;
        }

        // Invalidate gather targets that are empty
        if (creep.heap.state === 'gather') {
            if ((target.amount !== undefined && target.amount < 50) || 
                (target.store && target.store.getUsedCapacity(RESOURCE_ENERGY) < 50)) {
                creep.heap.targetId = null;
                creep.heap.actionIntent = 'idle';
            }
        } 
        // Invalidate work targets
        else if (creep.heap.state === 'work') {
            // If creep emptied its inventory, task is done
            if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
                creep.heap.targetId = null;
                creep.heap.actionIntent = 'idle';
            }
            // If target filled up, task is invalid
            else if (target.store && target.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
                creep.heap.targetId = null;
                creep.heap.actionIntent = 'idle';
            }
        }
    }

    static assignTask(creep, roomState) {
        const role = creep.memory.role;
        
        if (role === 'harvester') Harvester.assignTask(creep, roomState);
        else if (role === 'hauler') Hauler.assignTask(creep, roomState);
        else if (role === 'upgrader') Upgrader.assignTask(creep, roomState);
        else if (role === 'builder') Builder.assignTask(creep, roomState);
    }
}

module.exports = TaskAssignmentManager;