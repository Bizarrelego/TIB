const ActionConstants = require('../constants/ActionConstants');
const IntelManager = require('../managers/IntelManager');

class Scout {
    static run(creep) {
        if (creep.fatigue > 0) return;

        const targetRoom = creep.heap.targetRoom;
        if (!targetRoom) {
            // No target, sit idle
            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
            return;
        }

        // If we are currently in the target room, we have successfully scouted it!
        // We move off the border to avoid accidentally bouncing back and forth.
        if (creep.room.name === targetRoom) {
            if (creep.pos.x <= 0 || creep.pos.x >= 49 || creep.pos.y <= 0 || creep.pos.y >= 49) {
                creep.heap.destination = { x: 25, y: 25, roomName: targetRoom, range: 20 };
                return;
            }

            // Force an instant snapshot to avoid waiting for the global 10-tick Intel clock
            IntelManager.scanAndSave(creep.room);
            
            // Job done. Clear target and idle to get a new assignment next tick.
            creep.heap.targetRoom = null;
            creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
            return;
        }

        // Otherwise, move to the target room
        creep.heap.destination = { x: 25, y: 25, roomName: targetRoom, range: 20 };
    }
}

module.exports = Scout;
