const ActionConstants = require('../../constants/ActionConstants');

function assignUpgrader(creep, roomState) {
    if (!roomState.controller) return;

    // Fixes upgrader spawn paralysis by enforcing strict physical routing to the controller before attempting to execute work intents.
    if (creep.pos.getRangeTo(roomState.controller) > 3) {
        creep.heap.destination = { x: roomState.controller.pos.x, y: roomState.controller.pos.y, roomName: roomState.controller.room.name, range: 3 };
        creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
        return;
    }

    // If the upgrader needs energy, issue a gather intent first
    if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
        // Priority 0: Withdraw from adjacent link
        if (roomState.links) {
            for (let i = 0; i < roomState.links.length; i++) {
                const link = roomState.links[i];
                if (link.pos.getRangeTo(creep) <= 1 && link.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                    creep.heap.targetId = link.id;
                    creep.heap.actionIntent = ActionConstants.ACTION_WITHDRAW;
                    return;
                }
            }
        }

        // Priority 1: Withdraw from controller container
        if (roomState.controllerContainers && roomState.controllerContainers.length > 0) {
            const c = roomState.controllerContainers[0];
            if (c.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                creep.heap.targetId = c.id;
                creep.heap.actionIntent = ActionConstants.ACTION_WITHDRAW;
                return;
            }
        }
        // Priority 2: Pickup adjacent dropped energy
        if (roomState.droppedEnergy && roomState.droppedEnergy.length > 0) {
            for (let i = 0; i < roomState.droppedEnergy.length; i++) {
                const d = roomState.droppedEnergy[i];
                if (Math.max(Math.abs(creep.pos.x - d.pos.x), Math.abs(creep.pos.y - d.pos.y)) <= 3) {
                    creep.heap.targetId = d.id;
                    creep.heap.actionIntent = ActionConstants.ACTION_PICKUP;
                    return;
                }
            }
        }
    }

    // Issue upgrade intent — Upgrader.js will handle movement
    creep.heap.targetId = roomState.controller.id;
    creep.heap.actionIntent = ActionConstants.ACTION_UPGRADE;
}

module.exports = { assignUpgrader };
