const ActionConstants = require('../constants/ActionConstants');

/**
 * Military Brain — commands all combat creeps.
 * Handles defensive squads, offensive squads, patrol duty, and aggressive zone targeting.
 * Strictly reads from global.State. Writes ONLY to creep.heap and creep.memory.
 */
class MilitaryManager {
    static run() {
        if (!global.State) return;

        // Build/refresh aggressive zone target queue every 50 ticks
        if (Game.time % 50 === 0) {
            MilitaryManager.buildAggressiveZoneQueue();
        }

        for (const roomName in Game.rooms) {
            const room = Game.rooms[roomName];
            if (!room.controller || !room.controller.my) continue;
            MilitaryManager.commandColony(room.name);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // COLONY COMMAND LOOP
    // ─────────────────────────────────────────────────────────────────────────────

    static commandColony(colony) {
        const homeState = global.State.rooms.get(colony);
        if (!homeState) return;

        const homeHasHostiles = homeState.hostiles && homeState.hostiles.length > 0;

        // Check outpost threats
        let outpostThreatRoom = null;
        const outposts = Memory.rooms[colony]?.outposts || [];
        if (!homeHasHostiles) {
            for (let i = 0; i < outposts.length; i++) {
                const oState = global.State.rooms.get(outposts[i]);
                if (oState && oState.hostiles && oState.hostiles.length > 0) {
                    outpostThreatRoom = outposts[i];
                    break;
                }
            }
        }

        const hasThreat = homeHasHostiles || outpostThreatRoom !== null;

        // Command each military creep
        for (const creepName in Game.creeps) {
            const creep = Game.creeps[creepName];
            if (creep.memory.colony !== colony) continue;

            const role = creep.memory.role;
            if (role !== 'meleeCreep' && role !== 'rangerCreep' && role !== 'medicCreep') continue;
            if (creep.spawning) continue;
            if (creep.heap.state !== 'idle') continue;

            if (hasThreat) {
                // Defensive priority: home threats first, then outpost threats
                if (homeHasHostiles) {
                    MilitaryManager.assignDefensive(creep, homeState, colony);
                } else {
                    MilitaryManager.assignOutpostDefense(creep, outpostThreatRoom);
                }
            } else {
                // Check if there are offensive targets queued
                const queue = global.State.militaryQueue;
                if (queue && queue.length > 0) {
                    MilitaryManager.assignOffensive(creep, queue[0], colony);
                } else {
                    MilitaryManager.assignPatrol(creep, homeState, colony);
                }
            }
        }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // DEFENSIVE ASSIGNMENT
    // ─────────────────────────────────────────────────────────────────────────────

    static assignDefensive(creep, homeState, colony) {
        const hostiles = homeState.hostiles;
        if (!hostiles || hostiles.length === 0) return;

        // Pick the closest hostile to this creep
        let closestHostile = null;
        let closestDist = Infinity;
        for (let i = 0; i < hostiles.length; i++) {
            const h = hostiles[i];
            const d = Math.max(Math.abs(creep.pos.x - h.pos.x), Math.abs(creep.pos.y - h.pos.y));
            if (d < closestDist) {
                closestDist = d;
                closestHostile = h;
            }
        }
        if (!closestHostile) return;

        const role = creep.memory.role;

        if (role === 'meleeCreep') {
            creep.heap.targetId = closestHostile.id;
            creep.heap.actionIntent = ActionConstants.ACTION_ATTACK;
            creep.heap.state = 'combat';

        } else if (role === 'rangerCreep') {
            if (creep.heap.tooClose) {
                // Calculate flee tile: step directly away from the hostile
                const fx = Math.min(48, Math.max(1, creep.pos.x + (creep.pos.x - closestHostile.pos.x)));
                const fy = Math.min(48, Math.max(1, creep.pos.y + (creep.pos.y - closestHostile.pos.y)));
                creep.heap.fleePos = { x: fx, y: fy, roomName: creep.room.name };
                creep.heap.tooClose = false;
                creep.heap.actionIntent = ActionConstants.ACTION_FLEE;
                creep.heap.state = 'combat';
            } else {
                creep.heap.targetId = closestHostile.id;
                creep.heap.actionIntent = ActionConstants.ACTION_RANGED_ATTACK;
                creep.heap.state = 'combat';
            }

        } else if (role === 'medicCreep') {
            // Heal the most-damaged friendly combat creep in this room
            const healTarget = MilitaryManager.findMostDamagedAlly(colony, creep.room.name);
            if (healTarget) {
                creep.heap.targetId = healTarget.id;
                creep.heap.actionIntent = ActionConstants.ACTION_HEAL;
                creep.heap.state = 'combat';
            } else {
                // No injured allies — follow the melee creep
                const melee = MilitaryManager.findAllyByRole(colony, 'meleeCreep', creep.room.name);
                if (melee) {
                    creep.heap.targetId = melee.id;
                    creep.heap.actionIntent = ActionConstants.ACTION_HEAL;
                    creep.heap.state = 'combat';
                }
            }
        }
    }

    static assignOutpostDefense(creep, targetRoom) {
        if (creep.room.name !== targetRoom) {
            creep.memory.targetRoom = targetRoom;
            creep.heap.actionIntent = ActionConstants.ACTION_MOVE_ROOM;
            creep.heap.state = 'moving';
            return;
        }

        const oState = global.State.rooms.get(targetRoom);
        if (!oState || !oState.hostiles || oState.hostiles.length === 0) {
            creep.heap.state = 'idle';
            return;
        }

        const hostile = oState.hostiles[0];
        if (creep.memory.role === 'meleeCreep') {
            creep.heap.targetId = hostile.id;
            creep.heap.actionIntent = ActionConstants.ACTION_ATTACK;
            creep.heap.state = 'combat';
        } else if (creep.memory.role === 'rangerCreep') {
            creep.heap.targetId = hostile.id;
            creep.heap.actionIntent = ActionConstants.ACTION_RANGED_ATTACK;
            creep.heap.state = 'combat';
        } else if (creep.memory.role === 'medicCreep') {
            const healTarget = MilitaryManager.findMostDamagedAlly(creep.memory.colony, targetRoom);
            if (healTarget) {
                creep.heap.targetId = healTarget.id;
                creep.heap.actionIntent = ActionConstants.ACTION_HEAL;
                creep.heap.state = 'combat';
            }
        }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // OFFENSIVE ASSIGNMENT
    // ─────────────────────────────────────────────────────────────────────────────

    static assignOffensive(creep, targetRoom, colony) {
        // Move to target room first
        if (creep.room.name !== targetRoom) {
            creep.memory.targetRoom = targetRoom;
            creep.heap.actionIntent = ActionConstants.ACTION_MOVE_ROOM;
            creep.heap.state = 'moving';
            return;
        }

        // In target room — engage any hostiles or structures
        const roomState = global.State.rooms.get(targetRoom);
        if (!roomState) return;

        if (creep.memory.role === 'meleeCreep') {
            const hostile = roomState.hostiles && roomState.hostiles[0];
            if (hostile) {
                creep.heap.targetId = hostile.id;
                creep.heap.actionIntent = ActionConstants.ACTION_ATTACK;
                creep.heap.state = 'combat';
            } else {
                // No creeps — harass structures (invader cores, towers, spawns)
                const structTarget = MilitaryManager.pickOffensiveStructure(roomState);
                if (structTarget) {
                    creep.heap.targetId = structTarget.id;
                    creep.heap.actionIntent = ActionConstants.ACTION_ATTACK;
                    creep.heap.state = 'combat';
                }
            }

        } else if (creep.memory.role === 'rangerCreep') {
            const hostile = roomState.hostiles && roomState.hostiles[0];
            if (hostile) {
                if (creep.heap.tooClose) {
                    const fx = Math.min(48, Math.max(1, creep.pos.x + (creep.pos.x - hostile.pos.x)));
                    const fy = Math.min(48, Math.max(1, creep.pos.y + (creep.pos.y - hostile.pos.y)));
                    creep.heap.fleePos = { x: fx, y: fy, roomName: creep.room.name };
                    creep.heap.tooClose = false;
                    creep.heap.actionIntent = ActionConstants.ACTION_FLEE;
                    creep.heap.state = 'combat';
                } else {
                    creep.heap.targetId = hostile.id;
                    creep.heap.actionIntent = ActionConstants.ACTION_RANGED_ATTACK;
                    creep.heap.state = 'combat';
                }
            } else {
                const structTarget = MilitaryManager.pickOffensiveStructure(roomState);
                if (structTarget) {
                    creep.heap.targetId = structTarget.id;
                    creep.heap.actionIntent = ActionConstants.ACTION_RANGED_ATTACK;
                    creep.heap.state = 'combat';
                }
            }

        } else if (creep.memory.role === 'medicCreep') {
            const healTarget = MilitaryManager.findMostDamagedAlly(colony, targetRoom);
            if (healTarget) {
                creep.heap.targetId = healTarget.id;
                creep.heap.actionIntent = ActionConstants.ACTION_HEAL;
                creep.heap.state = 'combat';
            } else {
                // Follow melee if nothing to heal
                const melee = MilitaryManager.findAllyByRole(colony, 'meleeCreep', targetRoom);
                if (melee) {
                    creep.heap.targetId = melee.id;
                    creep.heap.actionIntent = ActionConstants.ACTION_HEAL;
                    creep.heap.state = 'combat';
                }
            }
        }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // PATROL ASSIGNMENT
    // ─────────────────────────────────────────────────────────────────────────────

    static assignPatrol(creep, homeState, colony) {
        // Cache waypoints in global.State to avoid per-tick Memory reads/writes
        if (!global.State.patrolWaypoints) global.State.patrolWaypoints = {};

        if (!global.State.patrolWaypoints[colony]) {
            // First: try to load from persistent Memory if user has set custom waypoints
            const mem = Memory.rooms[colony];
            if (mem && mem.patrolWaypoints && mem.patrolWaypoints.length > 0) {
                global.State.patrolWaypoints[colony] = mem.patrolWaypoints;
            } else {
                // Default: 2 waypoints — near spawn and near controller
                const spawn = homeState.spawns && homeState.spawns[0];
                const controller = homeState.controller;
                if (!spawn || !controller) {
                    creep.heap.state = 'idle';
                    return;
                }
                global.State.patrolWaypoints[colony] = [
                    { x: spawn.pos.x, y: spawn.pos.y, roomName: colony },
                    { x: controller.pos.x, y: controller.pos.y, roomName: colony }
                ];
            }
        }

        const waypoints = global.State.patrolWaypoints[colony];
        if (!creep.heap.waypointIndex) creep.heap.waypointIndex = 0;

        const wp = waypoints[creep.heap.waypointIndex % waypoints.length];
        creep.heap.waypointPos = wp;
        creep.heap.actionIntent = ActionConstants.ACTION_PATROL;
        creep.heap.state = 'patrol';
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // AGGRESSIVE ZONE TARGETING
    // ─────────────────────────────────────────────────────────────────────────────

    /**
     * Scores all rooms within 3 hops and writes top-3 targets to global.State.militaryQueue.
     * Runs every 50 ticks from MilitaryManager.run().
     */
    static buildAggressiveZoneQueue() {
        if (!global.State) return;
        if (!Memory.rooms) return;

        const visited = new Set();
        const scores = [];

        // Breadth-first expansion up to 3 hops from any owned room
        const frontier = [];
        for (const roomName in Game.rooms) {
            const room = Game.rooms[roomName];
            if (room.controller && room.controller.my) {
                frontier.push({ roomName, hop: 0 });
                visited.add(roomName);
            }
        }

        for (let fi = 0; fi < frontier.length; fi++) {
            const { roomName, hop } = frontier[fi];
            if (hop >= 3) continue;

            const exits = Game.map.describeExits(roomName);
            if (!exits) continue;

            for (const dir in exits) {
                const neighbor = exits[dir];
                if (visited.has(neighbor)) continue;
                visited.add(neighbor);
                frontier.push({ roomName: neighbor, hop: hop + 1 });

                const intel = Memory.rooms[neighbor];
                let score = 0;

                if (intel) {
                    if (intel.controller && intel.controller.owner) score += 100;
                    if (intel.sources && intel.sources.length > 0) score += 50 * intel.sources.length;
                    if (intel.hostiles && intel.hostiles.creeps > 0) score += 30;
                    if (intel.droppedEnergy > 500) score += 15;
                    const staleness = Game.time - (intel.scoutedAt || 0);
                    if (staleness > 1000) score += 20;
                } else {
                    // No intel at all — moderate priority to scout it
                    score += 25;
                }

                if (score > 0) {
                    scores.push({ roomName: neighbor, score });
                }
            }
        }

        // Sort descending by score, take top 3
        scores.sort((a, b) => b.score - a.score);
        global.State.militaryQueue = scores.slice(0, 3).map(s => s.roomName);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // UTILITY HELPERS
    // ─────────────────────────────────────────────────────────────────────────────

    static findMostDamagedAlly(colony, roomName) {
        let worstCreep = null;
        let worstRatio = 1.0;

        for (const name in Game.creeps) {
            const c = Game.creeps[name];
            if (c.memory.colony !== colony) continue;
            if (c.room.name !== roomName) continue;
            const ratio = c.hits / c.hitsMax;
            if (ratio < worstRatio) {
                worstRatio = ratio;
                worstCreep = c;
            }
        }
        return worstCreep;
    }

    static findAllyByRole(colony, role, roomName) {
        for (const name in Game.creeps) {
            const c = Game.creeps[name];
            if (c.memory.colony === colony && c.memory.role === role && c.room.name === roomName) {
                return c;
            }
        }
        return null;
    }

    static pickOffensiveStructure(roomState) {
        // Priority: invader cores > towers > spawns
        if (roomState.invaderCores && roomState.invaderCores.length > 0) return roomState.invaderCores[0];
        if (roomState.towers && roomState.towers.length > 0) {
            for (let i = 0; i < roomState.towers.length; i++) {
                if (!roomState.towers[i].my) return roomState.towers[i];
            }
        }
        if (roomState.spawns && roomState.spawns.length > 0) {
            for (let i = 0; i < roomState.spawns.length; i++) {
                if (!roomState.spawns[i].my) return roomState.spawns[i];
            }
        }
        return null;
    }
}

module.exports = MilitaryManager;
