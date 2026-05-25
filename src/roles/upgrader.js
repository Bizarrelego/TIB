const TrafficManager = require('../traffic/trafficManager');
const movement = require('../utils/movement');
const { isWalkable } = require('../utils/roomPositionUtils');

function getUpgraderAnchor(room) {
    if (!global.State.upgraderAnchors) global.State.upgraderAnchors = new Map();
    if (global.State.upgraderAnchors.has(room.name)) return global.State.upgraderAnchors.get(room.name);
    const cpos = room.controller.pos;
    for (let dx = -2; dx <= 2; dx++) {
        for (let dy = -2; dy <= 2; dy++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) === 2) {
                const x = cpos.x + dx;
                const y = cpos.y + dy;
                if (isWalkable(room.name, x, y)) {
                    const pos = new RoomPosition(x, y, room.name);
                    global.State.upgraderAnchors.set(room.name, pos);
                    return pos;
                }
            }
        }
    }
    return null;
}

// Upgraders must be static. Move once, then stay forever.
function run(creep, room) {
    if (room.memory.haltUpgrades) return;

    const controller = room.controller;
    if (!controller) return;

    try {
        if (creep.fatigue > 0) return;

        // Lock position adjacent to controller and pull from drop pile or Storage
        const anchor = getUpgraderAnchor(room) || controller;
        if (creep.pos.getRangeTo(anchor) > 0 && anchor !== controller) {
            movement.moveTo(creep, anchor);
        } else if (creep.pos.getRangeTo(controller) > 1 && anchor === controller) {
            movement.moveTo(creep, controller);
        } else {
            TrafficManager.registerStatic(creep);

            let energyTarget = null;
            if (creep.heap.energyTargetId) {
                energyTarget = Game.getObjectById(creep.heap.energyTargetId);
            }

            if (energyTarget && creep.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                if (energyTarget.amount !== undefined) {
                    creep.pickup(energyTarget);
                } else {
                    const status = TrafficManager.registerWithdraw(creep, energyTarget, RESOURCE_ENERGY, creep.store.getFreeCapacity(RESOURCE_ENERGY));
                    if (status !== OK && creep.pos.getRangeTo(energyTarget) > 1) {
                        movement.moveTo(creep, energyTarget);
                    }
                }
            }
            if (creep.heap && creep.heap.overrideTask === 'build') {
                const sites = global.State.sitesByRoom.get(room.name);
                if (sites && sites.length > 0) {
                    const site = sites[0];
                    if (creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                        TrafficManager.registerBuild(creep, site);
                    }
                    return;
                }
            }

            if (creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                creep.upgradeController(controller);
            }
        }
    } catch (e) {
        console.log(`[Upgrader Role Error] Room ${room.name}, Creep ${creep.name}: ${e.stack}`);
    }
}

module.exports = { run };
