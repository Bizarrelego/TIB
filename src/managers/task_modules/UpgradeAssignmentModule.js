const ActionConstants = require('../../constants/ActionConstants');

function assignUpgrader(creep, roomState) {
    if (!roomState.controller) return;

    // Find the planned container tile
    const blueprint = global.Cache?.blueprints?.get(creep.room.name);
    let containerTile = null;
    if (blueprint && blueprint.containers) {
        for (let i = 0; i < blueprint.containers.length; i++) {
            const tile = blueprint.containers[i];
            if (Math.abs(tile.x - roomState.controller.pos.x) <= 3 && Math.abs(tile.y - roomState.controller.pos.y) <= 3) {
                containerTile = tile;
                break;
            }
        }
    }

    const focusPos = containerTile ? { x: containerTile.x, y: containerTile.y, roomName: creep.room.name } : roomState.controller.pos;
    const focusRange = containerTile ? 1 : 3;

    // Fixes upgrader spawn paralysis by enforcing strict physical routing to the controller hub before attempting to execute work intents.
    if (creep.pos.getRangeTo(focusPos.x !== undefined ? new RoomPosition(focusPos.x, focusPos.y, focusPos.roomName) : focusPos) > focusRange) {
        creep.heap.destination = { x: focusPos.x, y: focusPos.y, roomName: focusPos.roomName, range: focusRange };
        creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
        return;
    }

    // Opportunistic Pickup: If energy is dropped perfectly adjacent, snatch it while upgrading!
    if (creep.store.getFreeCapacity(RESOURCE_ENERGY) > 0 && roomState.droppedEnergy && roomState.droppedEnergy.length > 0) {
        let found = false;
        for (let i = 0; i < roomState.droppedEnergy.length; i++) {
            const d = roomState.droppedEnergy[i];
            if (Math.max(Math.abs(creep.pos.x - d.pos.x), Math.abs(creep.pos.y - d.pos.y)) <= 1) {
                creep.heap.secondaryTargetId = d.id;
                creep.heap.secondaryIntent = ActionConstants.ACTION_PICKUP;
                found = true;
                break;
            }
        }
        if (!found) {
            creep.heap.secondaryTargetId = null;
            creep.heap.secondaryIntent = null;
        }
    } else {
        creep.heap.secondaryTargetId = null;
        creep.heap.secondaryIntent = null;
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

        // Priority 3: Fallback to Storage/Terminal if RCL 4 (no links/containers)
        if (roomState.storage && roomState.storage.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
            creep.heap.targetId = roomState.storage.id;
            creep.heap.actionIntent = ActionConstants.ACTION_WITHDRAW;
            return;
        }

        if (roomState.terminal && roomState.terminal.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
            creep.heap.targetId = roomState.terminal.id;
            creep.heap.actionIntent = ActionConstants.ACTION_WITHDRAW;
            return;
        }
    }

    // Issue upgrade intent — Upgrader.js will handle movement
    creep.heap.targetId = roomState.controller.id;
    creep.heap.actionIntent = ActionConstants.ACTION_UPGRADE;
}

module.exports = { assignUpgrader };
