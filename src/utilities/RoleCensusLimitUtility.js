/**
 * RCL-aware census limits for aggressive early-game progression.
 * Returns hardcoded integer limits per AGENTS.md — no dynamic math.
 */
class RoleCensusLimitUtility {
    /**
     * Census tables indexed by RCL.
     * RCL 1: Lean bootstrap — no builders (nothing to build yet), 1 upgrader to push RCL.
     * RCL 2: Builders spawn to build extensions from blueprint.
     * RCL 3: Max haulers + upgraders for aggressive RCL push.
     * RCL 4+: Fewer builders (maintenance), more upgraders.
     */
    static get CENSUS_BY_RCL() {
        return {
            1: { harvester: 2, hauler: 4, upgrader: 3, builder: 0 },
            2: { harvester: 2, hauler: 4, upgrader: 4, builder: 3 },
            3: { harvester: 2, hauler: 3, upgrader: 5, builder: 3 }, // Haulers are big now, need fewer
            4: { harvester: 2, hauler: 2, upgrader: 4, builder: 2 }, // T4 bodies are massive
            5: { harvester: 2, hauler: 2, upgrader: 4, builder: 2 },
            6: { harvester: 2, hauler: 2, upgrader: 4, builder: 2 },
            7: { harvester: 2, hauler: 2, upgrader: 3, builder: 1 },
            8: { harvester: 2, hauler: 2, upgrader: 1, builder: 1 }  // RCL 8 only needs 1 upgrader (15 e/t max)
        };
    }

    static getLimit(role, rcl, roomState, roomName) {
        const limits = this.getAllLimits(rcl, roomState, roomName);
        return limits[role] || 0;
    }

    static getAllLimits(rcl, roomState, roomName) {
        const limits = Object.assign({}, this.CENSUS_BY_RCL[rcl] || this.CENSUS_BY_RCL[4]);

        if (roomState) {
            let looseEnergy = 0;
            if (roomState.droppedEnergy) {
                for (let i = 0; i < roomState.droppedEnergy.length; i++) looseEnergy += roomState.droppedEnergy[i].amount;
            }
            if (roomState.sourceContainers) {
                for (let i = 0; i < roomState.sourceContainers.length; i++) looseEnergy += roomState.sourceContainers[i].store.getUsedCapacity(RESOURCE_ENERGY);
            }

            if (looseEnergy > 1500) {
                const extraHaulers = Math.min(4, Math.floor(looseEnergy / 1500));
                limits.hauler += extraHaulers;
            }

            if (roomState.storage && roomState.storage.my) {
                limits.filler = 1;
                limits.repairman = 1;
            }

            // Emergency Storage Protocol
            if (rcl >= 4) {
                if (!roomState.storage || !roomState.storage.my) {
                    limits.upgrader = 1; // Slash upgraders to conserve energy
                    limits.builder = 4;  // Boost builders to fast-track storage
                }
            }
        }

        if (roomName && Memory.rooms && Memory.rooms[roomName] && Memory.rooms[roomName].outposts) {
            const outposts = Memory.rooms[roomName].outposts;
            let remoteSources = 0;
            for (let i = 0; i < outposts.length; i++) {
                const adjMem = Memory.rooms[outposts[i]];
                if (adjMem && adjMem.sources) {
                    remoteSources += adjMem.sources.length;
                }
            }
            if (remoteSources > 0) {
                limits.remoteharvester = remoteSources;
                limits.remotehauler = remoteSources * 2; // 2 haulers per remote source
            }
        }

        // Add dynamic scout limit
        limits.scout = (global.State && global.State.scoutQueue && global.State.scoutQueue.length > 0) ? 1 : 0;

        // Add dynamic defender limit (legacy primitive defender)
        let hostilesFound = false;
        if (roomState && roomState.hostiles && roomState.hostiles.length > 0) hostilesFound = true;
        if (!hostilesFound && roomName && Memory.rooms && Memory.rooms[roomName] && Memory.rooms[roomName].outposts) {
            const outposts = Memory.rooms[roomName].outposts;
            for (let i = 0; i < outposts.length; i++) {
                const outpostState = global.State?.rooms?.get(outposts[i]);
                if (outpostState && outpostState.hostiles && outpostState.hostiles.length > 0) {
                    hostilesFound = true;
                    break;
                }
            }
        }
        limits.defender = hostilesFound ? 1 : 0;

        // Military squad: spawn defensive squad when threats are present
        const hasOffensiveQueue = global.State && global.State.militaryQueue && global.State.militaryQueue.length > 0;
        if (hostilesFound) {
            limits.meleeCreep = Math.min(2, (limits.meleeCreep || 0) + 1);
            limits.rangerCreep = Math.min(2, (limits.rangerCreep || 0) + 1);
            limits.medicCreep = Math.min(2, (limits.medicCreep || 0) + 1);
        }

        // Offensive squad: spawn when rcl >= 4 and there are aggression targets
        if (rcl >= 4 && hasOffensiveQueue) {
            limits.meleeCreep = Math.min(2, (limits.meleeCreep || 0) + 1);
            limits.rangerCreep = Math.min(2, (limits.rangerCreep || 0) + 1);
            limits.medicCreep = Math.min(2, (limits.medicCreep || 0) + 1);
        }

        return limits;
    }
}

module.exports = RoleCensusLimitUtility;
