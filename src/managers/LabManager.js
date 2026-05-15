/* eslint-disable no-redeclare */
/* global STRUCTURE_LAB, RESOURCE_ENERGY, REACTIONS */
const Profiler = require('../utils/profiler');

/**
 * Manages lab logistics and reactions.
 */
class LabManager {
    /**
     * Executes lab management logic for the room.
     * @param {Room} room - The room object.
     */
    static run(room) {
        try {
            const labMap = global.State.structuresByRoom.get(room.name)?.get(STRUCTURE_LAB);
            if (!labMap || labMap.size < 3) return;

            const labs = Array.from(labMap.values());

            // Re-identify labs occasionally or if heap is missing
            if (!room.heap) room.heap = new Map();
            let labConfig = room.heap.get('labConfig');
            if (!labConfig || Game.time % 100 === 0) {
                labConfig = this.identifyLabs(labs);
                room.heap.set('labConfig', labConfig);
            }

            if (!labConfig) return;

            let labReaction = room.heap.get('labReaction');
            if (!labReaction || Game.time % 50 === 0) {
                labReaction = this.determineReaction(room);
                room.heap.set('labReaction', labReaction);
            }

            this.runReactions(labConfig, labReaction);
            this.assignCreepTasks(room, labConfig, labReaction);

        } catch (e) {
            console.error(`[LabManager Error] Room ${room.name}: ${e.stack}`);
        }
    }

    /**
     * Identifies input and output labs based on proximity.
     * @param {StructureLab[]} labs - The array of labs in the room.
     * @returns {{input1: string, input2: string, outputs: string[]}|null} The lab configuration or null.
     */
    static identifyLabs(labs) {
        if (labs.length < 3) return null;

        // Simple heuristic: find 2 labs that are closest to each other and most other labs
        // Here we just pick the first two that are in range 2 of each other and use rest as output
        let input1 = null;
        let input2 = null;
        let outputs = [];

        // O(N^2) but N <= 10
        for (let i = 0; i < labs.length; i++) {
            for (let j = i + 1; j < labs.length; j++) {
                if (labs[i].pos.inRangeTo(labs[j], 2)) {
                    input1 = labs[i];
                    input2 = labs[j];
                    break;
                }
            }
            if (input1) break;
        }

        if (!input1 || !input2) return null;

        for (const lab of labs) {
            if (lab.id !== input1.id && lab.id !== input2.id) {
                if (lab.pos.inRangeTo(input1, 2) && lab.pos.inRangeTo(input2, 2)) {
                    outputs.push(lab);
                }
            }
        }

        return {
            input1: input1.id,
            input2: input2.id,
            outputs: outputs.map(l => l.id)
        };
    }

    /**
     * Determines the optimal reaction to run based on available reagents.
     * @param {Room} room - The room object.
     * @returns {{reagent1: string, reagent2: string, product: string}|null} The reaction object or null.
     */
    static determineReaction(room) {
        const storage = room.storage;
        const terminal = room.terminal;
        if (!storage || !terminal) return null;

        // Example simple logic: pick the first available reaction where we have both reagents
        // In a real scenario, this would be tied to global economy requests
        const MIN_REAGENT = 1000;

        for (const reagent1 in REACTIONS) {
            for (const reagent2 in REACTIONS[reagent1]) {
                const amount1 = (storage.store[reagent1] || 0) + (terminal.store[reagent1] || 0);
                const amount2 = (storage.store[reagent2] || 0) + (terminal.store[reagent2] || 0);

                if (amount1 >= MIN_REAGENT && amount2 >= MIN_REAGENT) {
                    return {
                        reagent1: reagent1,
                        reagent2: reagent2,
                        product: REACTIONS[reagent1][reagent2]
                    };
                }
            }
        }

        return null;
    }

    /**
     * Triggers the runReaction command on all valid output labs.
     * @param {{input1: string, input2: string, outputs: string[]}} labConfig - The lab configuration.
     * @param {{reagent1: string, reagent2: string, product: string}} labReaction - The reaction to run.
     */
    static runReactions(labConfig, labReaction) {
        if (!labReaction) return;

        const input1 = Game.getObjectById(labConfig.input1);
        const input2 = Game.getObjectById(labConfig.input2);

        if (!input1 || !input2) return;

        const in1Resource = Object.keys(input1.store).find(k => k !== RESOURCE_ENERGY);
        const in2Resource = Object.keys(input2.store).find(k => k !== RESOURCE_ENERGY);

        // Ensure inputs contain correct minerals
        if (in1Resource !== labReaction.reagent1 || in2Resource !== labReaction.reagent2) return;
        if (input1.store[in1Resource] < 5 || input2.store[in2Resource] < 5) return;

        for (const outId of labConfig.outputs) {
            const outLab = Game.getObjectById(outId);
            if (outLab && outLab.cooldown === 0) {
                const outResource = Object.keys(outLab.store).find(k => k !== RESOURCE_ENERGY);
                // If it has wrong mineral type, wait for creep to empty it
                if (outResource && outResource !== labReaction.product) continue;
                // If full, wait
                if (outLab.store.getFreeCapacity(labReaction.product) === 0) continue;

                outLab.runReaction(input1, input2);
            }
        }
    }

    /**
     * Assigns top-down transport tasks to labManager creeps.
     * @param {Room} room - The room object.
     * @param {{input1: string, input2: string, outputs: string[]}} labConfig - The lab configuration.
     * @param {{reagent1: string, reagent2: string, product: string}} labReaction - The reaction to run.
     */
    static assignCreepTasks(room, labConfig, labReaction) {
        const roomCreeps = global.State.creepsByRoom.get(room.name);
        if (!roomCreeps) return;

        const labManagers = roomCreeps.get('labManager');
        if (!labManagers || labManagers.length === 0) return;

        const input1 = Game.getObjectById(labConfig.input1);
        const input2 = Game.getObjectById(labConfig.input2);

        // Ensure labs exist
        if (!input1 || !input2) return;

        const storage = room.storage;
        const terminal = room.terminal;

        for (const creep of labManagers) {
            if (!creep.heap) creep.heap = new Map();
            // Priority 1: If carrying wrong mineral, deposit it to storage
            let carryingOther = false;
            let wrongResource = null;
            for (const res in creep.store) {
                if (res !== RESOURCE_ENERGY && (!labReaction || (res !== labReaction.reagent1 && res !== labReaction.reagent2))) {
                    carryingOther = true;
                    wrongResource = res;
                    break;
                }
            }

            if (carryingOther) {
                creep.heap.set('state', 'store_wrong');
                creep.heap.set('targetId', storage ? storage.id : null);
                creep.heap.set('resource', wrongResource);
                continue;
            }

            // If no reaction, just idle or clean up
            if (!labReaction) {
                creep.heap.set('state', 'idle');
                continue;
            }

            // Priority 2: Empty output labs if full or wrong mineral
            let outputToEmpty = null;
            let outputResource = null;
            for (const outId of labConfig.outputs) {
                const outLab = Game.getObjectById(outId);
                if (outLab) {
                    const outRes = Object.keys(outLab.store).find(k => k !== RESOURCE_ENERGY);
                    if (outRes) {
                        if (outRes !== labReaction.product || outLab.store[outRes] > 2000) {
                            outputToEmpty = outLab;
                            outputResource = outRes;
                            break;
                        }
                    }
                }
            }

            if (outputToEmpty) {
                if (creep.store.getUsedCapacity() > 0) {
                    // Deadlock fix: drop whatever wrong item we are carrying first
                    const carriedRes = Object.keys(creep.store).find(k => k !== RESOURCE_ENERGY);
                    if (carriedRes) {
                        creep.heap.set('state', 'store_output');
                        creep.heap.set('targetId', storage ? storage.id : terminal ? terminal.id : null);
                        creep.heap.set('resource', carriedRes);
                    }
                } else {
                    creep.heap.set('state', 'empty_output');
                    creep.heap.set('targetId', outputToEmpty.id);
                    creep.heap.set('resource', outputResource);
                }
                continue;
            }

            // Priority 3: Empty input labs if wrong mineral
            const in1Res = Object.keys(input1.store).find(k => k !== RESOURCE_ENERGY);
            if (in1Res && in1Res !== labReaction.reagent1) {
                if (creep.store.getUsedCapacity() > 0) {
                    const carriedRes = Object.keys(creep.store).find(k => k !== RESOURCE_ENERGY);
                    if (carriedRes) {
                        creep.heap.set('state', 'store_wrong');
                        creep.heap.set('targetId', storage ? storage.id : null);
                        creep.heap.set('resource', carriedRes);
                    }
                } else {
                    creep.heap.set('state', 'empty_wrong');
                    creep.heap.set('targetId', input1.id);
                    creep.heap.set('resource', in1Res);
                }
                continue;
            }

            const in2Res = Object.keys(input2.store).find(k => k !== RESOURCE_ENERGY);
            if (in2Res && in2Res !== labReaction.reagent2) {
                if (creep.store.getUsedCapacity() > 0) {
                    const carriedRes = Object.keys(creep.store).find(k => k !== RESOURCE_ENERGY);
                    if (carriedRes) {
                        creep.heap.set('state', 'store_wrong');
                        creep.heap.set('targetId', storage ? storage.id : null);
                        creep.heap.set('resource', carriedRes);
                    }
                } else {
                    creep.heap.set('state', 'empty_wrong');
                    creep.heap.set('targetId', input2.id);
                    creep.heap.set('resource', in2Res);
                }
                continue;
            }

            // Priority 4: Fill input labs
            if (input1.store[labReaction.reagent1] < 2000) {
                if (creep.store[labReaction.reagent1] > 0) {
                    creep.heap.set('state', 'fill_input1');
                    creep.heap.set('targetId', input1.id);
                    creep.heap.set('resource', labReaction.reagent1);
                } else {
                    creep.heap.set('state', 'gather_input1');
                    creep.heap.set('targetId', storage && storage.store[labReaction.reagent1] > 0 ? storage.id : terminal && terminal.store[labReaction.reagent1] > 0 ? terminal.id : null);
                    creep.heap.set('resource', labReaction.reagent1);
                }
                continue;
            }

            if (input2.store[labReaction.reagent2] < 2000) {
                if (creep.store[labReaction.reagent2] > 0) {
                    creep.heap.set('state', 'fill_input2');
                    creep.heap.set('targetId', input2.id);
                    creep.heap.set('resource', labReaction.reagent2);
                } else {
                    creep.heap.set('state', 'gather_input2');
                    creep.heap.set('targetId', storage && storage.store[labReaction.reagent2] > 0 ? storage.id : terminal && terminal.store[labReaction.reagent2] > 0 ? terminal.id : null);
                    creep.heap.set('resource', labReaction.reagent2);
                }
                continue;
            }

            creep.heap.set('state', 'idle');
        }
    }
}

for (const method of Object.getOwnPropertyNames(LabManager)) {
    if (typeof LabManager[method] === 'function' && method !== 'constructor' && method !== 'prototype' && method !== 'name' && method !== 'length') {
        LabManager[method] = Profiler.wrap(`LabManager.${method}`, LabManager[method]);
    }
}

module.exports = LabManager;
