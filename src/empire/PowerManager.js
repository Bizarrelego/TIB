/**
 * Power Manager
 * Manages the end-game economy via Power Creeps, generating ops and buffing structures.
 */
class PowerManager {
    static run() {
        if (Game.time % 5 !== 0) return;
        if (!global.State || !global.State.colonies) return;

        // Ensure we have an Operator class power creep
        const operatorName = 'Operator_1';
        let operator = Game.powerCreeps[operatorName];

        if (!operator) {
            // We need to spawn the operator. Find the highest RCL room with a PowerSpawn
            let bestRoom = null;
            let highestRCL = 0;
            
            for (const colony of global.State.colonies.values()) {
                const room = Game.rooms[colony.name];
                if (room && room.controller && room.controller.level > highestRCL) {
                    const roomState = global.State.rooms.get(colony.name);
                    if (roomState && roomState.powerSpawns && roomState.powerSpawns.length > 0) {
                        highestRCL = room.controller.level;
                        bestRoom = room;
                    }
                }
            }

            if (bestRoom) {
                const roomState = global.State.rooms.get(bestRoom.name);
                const powerSpawn = roomState.powerSpawns[0];
                
                // If the power creep exists in the account but is not spawned
                const pc = Object.values(Game.powerCreeps).find(c => c.className === POWER_CLASS.OPERATOR);
                if (pc) {
                    pc.spawn(powerSpawn);
                    console.log(`[PowerManager] Spawning Operator in ${bestRoom.name}`);
                }
            }
            return;
        }

        if (!operator.ticksToLive) return; // Currently spawning

        // Renew Power Creep if needed
        if (operator.ticksToLive < 1000) {
            const roomState = global.State.rooms.get(operator.room.name);
            if (roomState && roomState.powerSpawns && roomState.powerSpawns.length > 0) {
                const ps = roomState.powerSpawns[0];
                if (operator.pos.isNearTo(ps)) {
                    operator.renew(ps);
                } else {
                    operator.moveTo(ps);
                }
                return; // Prioritize renewing
            }
        }

        // Enable Power in the room if not already enabled
        if (operator.room.controller && !operator.room.controller.isPowerEnabled) {
            if (operator.pos.isNearTo(operator.room.controller)) {
                operator.enableRoom(operator.room.controller);
            } else {
                operator.moveTo(operator.room.controller);
            }
            return;
        }

        // Ops generation loop
        if (operator.powers[PWR_GENERATE_OPS] && operator.powers[PWR_GENERATE_OPS].cooldown === 0) {
            operator.usePower(PWR_GENERATE_OPS);
        }

        // Structure buffs (prioritize Factory, then Extension)
        const roomState = global.State.rooms.get(operator.room.name);
        if (!roomState) return;

        // Operate Factory (if we have a factory and it's active)
        if (operator.powers[PWR_OPERATE_FACTORY] && operator.powers[PWR_OPERATE_FACTORY].cooldown === 0) {
            if (roomState.factories && roomState.factories.length > 0) {
                const factory = roomState.factories[0];
                if (operator.store.getUsedCapacity(RESOURCE_OPS) >= POWER_INFO[PWR_OPERATE_FACTORY].ops) {
                    if (operator.pos.inRangeTo(factory, 3)) {
                        operator.usePower(PWR_OPERATE_FACTORY, factory);
                    } else {
                        operator.moveTo(factory);
                    }
                    return;
                }
            }
        }

        // Operate Extension (if storage is nearly full or we need spawning speed)
        if (operator.powers[PWR_OPERATE_EXTENSION] && operator.powers[PWR_OPERATE_EXTENSION].cooldown === 0) {
            if (roomState.storage && roomState.storage.store.getUsedCapacity(RESOURCE_ENERGY) > 500000) {
                if (operator.store.getUsedCapacity(RESOURCE_OPS) >= POWER_INFO[PWR_OPERATE_EXTENSION].ops) {
                    if (operator.pos.inRangeTo(roomState.storage, 3)) {
                        operator.usePower(PWR_OPERATE_EXTENSION, roomState.storage);
                    } else {
                        operator.moveTo(roomState.storage);
                    }
                    return;
                }
            }
        }
        
        // Idle near the power spawn or storage
        if (roomState.storage) {
            if (!operator.pos.inRangeTo(roomState.storage, 3)) {
                operator.moveTo(roomState.storage);
            }
        }
    }
}

module.exports = PowerManager;
