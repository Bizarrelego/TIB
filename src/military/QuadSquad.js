const ActionConstants = require('../constants/ActionConstants');

const QUAD_STATE = {
    FORMING: 1,  // Moving to rally point to pair up
    ENGAGING: 2, // Moving as a 2x2 square to the target
    KITING: 3    // Retreating while ranged/healing to pull enemy out of position
};

/**
 * Tigga-style strictly coupled 4-creep Quad Squad.
 * Comprises exactly 2 Attackers (Leaders) and 2 Healers (Followers).
 */
class QuadSquad {
    constructor(id) {
        this.id = id;
    }

    static runSquad(squadMemory, creeps) {
        // Evaluate the health of the squad
        let isIntact = true;
        let lowestHits = 1;
        for (let i = 0; i < creeps.length; i++) {
            if (!creeps[i]) {
                isIntact = false;
                break;
            }
            const ratio = creeps[i].hits / creeps[i].hitsMax;
            if (ratio < lowestHits) lowestHits = ratio;
        }

        if (!isIntact) {
            // If the quad is broken, drop back to individual fallback logic or wait for reinforcements
            return false; 
        }

        const state = squadMemory.state || QUAD_STATE.FORMING;

        switch (state) {
            case QUAD_STATE.FORMING:
                this.executeForming(squadMemory, creeps);
                break;
            case QUAD_STATE.ENGAGING:
                this.executeEngaging(squadMemory, creeps, lowestHits);
                break;
            case QUAD_STATE.KITING:
                this.executeKiting(squadMemory, creeps, lowestHits);
                break;
        }
        return true;
    }

    static executeForming(squadMemory, creeps) {
        const rallyPos = squadMemory.rallyPos;
        if (!rallyPos) return;

        let allInPosition = true;
        const formationOffsets = [
            { x: 0, y: 0 },   // Leader 1 (Top Left)
            { x: 1, y: 0 },   // Leader 2 (Top Right)
            { x: 0, y: 1 },   // Medic 1 (Bottom Left)
            { x: 1, y: 1 }    // Medic 2 (Bottom Right)
        ];

        for (let i = 0; i < 4; i++) {
            const creep = creeps[i];
            const targetX = rallyPos.x + formationOffsets[i].x;
            const targetY = rallyPos.y + formationOffsets[i].y;

            if (creep.pos.x !== targetX || creep.pos.y !== targetY || creep.room.name !== rallyPos.roomName) {
                allInPosition = false;
                creep.heap.destination = { x: targetX, y: targetY, roomName: rallyPos.roomName, range: 0 };
                creep.heap.actionIntent = ActionConstants.ACTION_MOVE;
            } else {
                creep.heap.actionIntent = ActionConstants.ACTION_IDLE;
            }
        }

        if (allInPosition) {
            squadMemory.state = QUAD_STATE.ENGAGING;
        }
    }

    static executeEngaging(squadMemory, creeps, lowestHits) {
        if (lowestHits < 0.6) {
            squadMemory.state = QUAD_STATE.KITING;
            return;
        }

        const targetPos = squadMemory.targetPos;
        if (!targetPos) return;

        // Squad moves as a cohesive block using the leader's pathing
        const leader = creeps[0];
        leader.heap.destination = targetPos;
        leader.heap.actionIntent = ActionConstants.ACTION_MOVE;

        // The other 3 creeps strictly follow the offsets relative to the leader's next step
        // In the top-down pipeline, TrafficManager resolves their formation moves
        for (let i = 1; i < 4; i++) {
            creeps[i].heap.squadLeader = leader.name;
            creeps[i].heap.quadIndex = i;
            creeps[i].heap.actionIntent = ActionConstants.ACTION_SQUAD_MOVE;
        }

        // Apply combat intents
        this.applyCombatIntents(creeps);
    }

    static executeKiting(squadMemory, creeps, lowestHits) {
        if (lowestHits > 0.95) {
            squadMemory.state = QUAD_STATE.ENGAGING;
            return;
        }

        // Flee from the closest threat
        const leader = creeps[0];
        if (squadMemory.fleeTarget) {
            leader.heap.fleeGoals = [{ pos: squadMemory.fleeTarget, range: 4 }];
            leader.heap.actionIntent = ActionConstants.ACTION_FLEE;
            leader.heap.destination = null;
        }

        for (let i = 1; i < 4; i++) {
            creeps[i].heap.squadLeader = leader.name;
            creeps[i].heap.quadIndex = i;
            creeps[i].heap.actionIntent = ActionConstants.ACTION_SQUAD_MOVE;
        }

        this.applyCombatIntents(creeps);
    }

    static applyCombatIntents(creeps) {
        // Leaders (0 and 1) Attack
        for (let i = 0; i < 2; i++) {
            if (creeps[i].memory.role === 'meleeCreep' || creeps[i].memory.role === 'rangerCreep') {
                if (creeps[i].heap.targetId) {
                    creeps[i].heap.secondaryIntent = creeps[i].memory.role === 'meleeCreep' 
                        ? ActionConstants.ACTION_ATTACK 
                        : ActionConstants.ACTION_RANGED_ATTACK;
                }
            }
        }
        // Medics (2 and 3) Heal the lowest health member
        let lowestCreep = creeps[0];
        for (let i = 1; i < 4; i++) {
            if (creeps[i].hits < lowestCreep.hits) lowestCreep = creeps[i];
        }

        for (let i = 2; i < 4; i++) {
            creeps[i].heap.targetId = lowestCreep.id;
            creeps[i].heap.secondaryIntent = ActionConstants.ACTION_HEAL;
        }
    }
}

module.exports = { QUAD_STATE, QuadSquad };
