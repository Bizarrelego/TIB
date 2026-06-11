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

        // Run once per room logic
        let weAreStronger = false;
        let primaryTarget = null;
        if (homeHasHostiles) {
            weAreStronger = MilitaryManager.evaluateStrength(homeState, colony);
            primaryTarget = MilitaryManager.findPrimaryTarget(homeState);
        }

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
                    MilitaryManager.assignDefensive(creep, homeState, colony, weAreStronger, primaryTarget);
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

    static assignDefensive(creep, homeState, colony, weAreStronger, primaryTarget) {
        if (!primaryTarget) return;

        let closestDist = Math.max(Math.abs(creep.pos.x - primaryTarget.pos.x), Math.abs(creep.pos.y - primaryTarget.pos.y));

        const bestRampart = MilitaryManager.findBestRampart(creep, primaryTarget, homeState, weAreStronger);

        const role = creep.memory.role;

        if (role === 'meleeCreep') {
            if (bestRampart) {
                creep.heap.destination = { x: bestRampart.pos.x, y: bestRampart.pos.y, roomName: bestRampart.pos.roomName, range: 0 };
            } else {
                creep.heap.destination = { x: primaryTarget.pos.x, y: primaryTarget.pos.y, roomName: primaryTarget.pos.roomName, range: 1 };
            }
            creep.heap.targetId = primaryTarget.id;
            creep.heap.actionIntent = ActionConstants.ACTION_ATTACK;
            creep.heap.state = 'combat';

        } else if (role === 'rangerCreep') {
            if (bestRampart) {
                creep.heap.destination = { x: bestRampart.pos.x, y: bestRampart.pos.y, roomName: bestRampart.pos.roomName, range: 0 };
                creep.heap.fleeGoals = null; // Do not kite if we are holding a bunker rampart
            } else {
                // Replaces naive 1-tile math with native TrafficManager flee pathfinding, allowing rangers to kite flawlessly around terrain.
                if (closestDist <= 2) {
                    creep.heap.fleeGoals = [{ pos: primaryTarget.pos, range: 3 }];
                } else {
                    creep.heap.fleeGoals = null;
                    creep.heap.destination = { x: primaryTarget.pos.x, y: primaryTarget.pos.y, roomName: primaryTarget.pos.roomName, range: 3 };
                }
            }
            creep.heap.targetId = primaryTarget.id;
            creep.heap.actionIntent = ActionConstants.ACTION_RANGED_ATTACK;
            creep.heap.state = 'combat';

        } else if (role === 'medicCreep') {
            // Medics also seek a rampart if we are weaker, otherwise they just kite and follow.
            let medicRampart = null;
            if (!weAreStronger) {
                medicRampart = MilitaryManager.findBestRampart(creep, primaryTarget, homeState, weAreStronger);
            }

            if (medicRampart) {
                creep.heap.destination = { x: medicRampart.pos.x, y: medicRampart.pos.y, roomName: medicRampart.pos.roomName, range: 0 };
                creep.heap.fleeGoals = null;
            } else {
                if (closestDist <= 2) {
                    creep.heap.fleeGoals = [{ pos: primaryTarget.pos, range: 3 }];
                } else {
                    creep.heap.fleeGoals = null;
                }
            }

            const healTarget = MilitaryManager.findMostDamagedAlly(colony, creep.room.name);
            if (healTarget) {
                creep.heap.targetId = healTarget.id;
                creep.heap.actionIntent = ActionConstants.ACTION_HEAL;
                creep.heap.state = 'combat';
            } else {
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

        const hostiles = oState.hostiles;
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

        if (creep.memory.role === 'meleeCreep') {
            creep.heap.targetId = closestHostile.id;
            creep.heap.actionIntent = ActionConstants.ACTION_ATTACK;
            creep.heap.state = 'combat';
        } else if (creep.memory.role === 'rangerCreep') {
            // Replaces naive 1-tile math with native TrafficManager flee pathfinding, allowing rangers to kite flawlessly around terrain.
            if (closestDist <= 2) {
                creep.heap.fleeGoals = [{ pos: closestHostile.pos, range: 3 }];
            } else {
                creep.heap.fleeGoals = null;
                creep.heap.destination = { x: closestHostile.pos.x, y: closestHostile.pos.y, roomName: closestHostile.pos.roomName, range: 3 };
            }
            creep.heap.targetId = closestHostile.id;
            creep.heap.actionIntent = ActionConstants.ACTION_RANGED_ATTACK;
            creep.heap.state = 'combat';
        } else if (creep.memory.role === 'medicCreep') {
            // Adds survival instincts to medics via fleeGoals, preventing them from blindly following melee creeps into danger.
            if (closestDist <= 2) {
                creep.heap.fleeGoals = [{ pos: closestHostile.pos, range: 3 }];
            } else {
                creep.heap.fleeGoals = null;
            }

            const healTarget = MilitaryManager.findMostDamagedAlly(creep.memory.colony, targetRoom);
            if (healTarget) {
                creep.heap.targetId = healTarget.id;
                creep.heap.actionIntent = ActionConstants.ACTION_HEAL;
                creep.heap.state = 'combat';
            } else {
                const melee = MilitaryManager.findAllyByRole(creep.memory.colony, 'meleeCreep', targetRoom);
                if (melee) {
                    creep.heap.targetId = melee.id;
                    creep.heap.actionIntent = ActionConstants.ACTION_HEAL;
                    creep.heap.state = 'combat';
                }
            }
        }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // OFFENSIVE ASSIGNMENT
    // ─────────────────────────────────────────────────────────────────────────────

    static assignOffensive(creep, targetRoom, colony) {
        if (creep.room.name !== targetRoom) {
            creep.memory.targetRoom = targetRoom;
            creep.heap.actionIntent = ActionConstants.ACTION_MOVE_ROOM;
            creep.heap.state = 'moving';
            return;
        }

        const roomState = global.State.rooms.get(targetRoom);
        if (!roomState) return;

        const hostiles = roomState.hostiles || [];
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

        if (creep.memory.role === 'meleeCreep') {
            if (closestHostile) {
                creep.heap.targetId = closestHostile.id;
                creep.heap.actionIntent = ActionConstants.ACTION_ATTACK;
                creep.heap.state = 'combat';
            } else {
                const structTarget = MilitaryManager.pickOffensiveStructure(roomState);
                if (structTarget) {
                    creep.heap.targetId = structTarget.id;
                    creep.heap.actionIntent = ActionConstants.ACTION_ATTACK;
                    creep.heap.state = 'combat';
                }
            }

        } else if (creep.memory.role === 'rangerCreep') {
            if (closestHostile) {
                // Replaces naive 1-tile math with native TrafficManager flee pathfinding, allowing rangers to kite flawlessly around terrain.
                if (closestDist <= 2) {
                    creep.heap.fleeGoals = [{ pos: closestHostile.pos, range: 3 }];
                } else {
                    creep.heap.fleeGoals = null;
                    creep.heap.destination = { x: closestHostile.pos.x, y: closestHostile.pos.y, roomName: closestHostile.pos.roomName, range: 3 };
                }
                creep.heap.targetId = closestHostile.id;
                creep.heap.actionIntent = ActionConstants.ACTION_RANGED_ATTACK;
                creep.heap.state = 'combat';
            } else {
                const structTarget = MilitaryManager.pickOffensiveStructure(roomState);
                if (structTarget) {
                    creep.heap.targetId = structTarget.id;
                    creep.heap.actionIntent = ActionConstants.ACTION_RANGED_ATTACK;
                    creep.heap.state = 'combat';
                }
            }

        } else if (creep.memory.role === 'medicCreep') {
            // Adds survival instincts to medics via fleeGoals, preventing them from blindly following melee creeps into danger.
            if (closestHostile && closestDist <= 2) {
                creep.heap.fleeGoals = [{ pos: closestHostile.pos, range: 3 }];
            } else {
                creep.heap.fleeGoals = null;
            }

            const healTarget = MilitaryManager.findMostDamagedAlly(colony, targetRoom);
            if (healTarget) {
                creep.heap.targetId = healTarget.id;
                creep.heap.actionIntent = ActionConstants.ACTION_HEAL;
                creep.heap.state = 'combat';
            } else {
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
        if (!global.State.patrolWaypoints) global.State.patrolWaypoints = {};

        if (!global.State.patrolWaypoints[colony]) {
            const mem = Memory.rooms[colony];
            if (mem && mem.patrolWaypoints && mem.patrolWaypoints.length > 0) {
                global.State.patrolWaypoints[colony] = mem.patrolWaypoints;
            } else {
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

    static buildAggressiveZoneQueue() {
        if (!global.State) return;
        if (!Memory.rooms) return;

        const visited = new Set();
        const scores = [];

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
                    score += 25;
                }

                if (score > 0) {
                    scores.push({ roomName: neighbor, score });
                }
            }
        }

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
    static evaluateStrength(roomState, colony) {
        let enemyScore = 0;
        let allyScore = 0;

        const hostiles = roomState.hostiles || [];
        for (let i = 0; i < hostiles.length; i++) {
            const h = hostiles[i];
            for (let j = 0; j < h.body.length; j++) {
                const type = h.body[j].type;
                if (type === ATTACK || type === RANGED_ATTACK || type === HEAL) {
                    enemyScore++;
                }
            }
        }

        const alliedCreeps = roomState.creeps || [];
        for (let i = 0; i < alliedCreeps.length; i++) {
            const c = alliedCreeps[i];
            if (c.memory.colony !== colony) continue;
            const role = (c.memory.role || '').toLowerCase();
            if (role === 'meleecreep' || role === 'rangercreep' || role === 'mediccreep' || role === 'defender') {
                for (let j = 0; j < c.body.length; j++) {
                    const type = c.body[j].type;
                    if (type === ATTACK || type === RANGED_ATTACK || type === HEAL) {
                        allyScore++;
                    }
                }
            }
        }

        const towers = roomState.towers || [];
        allyScore += towers.length * 5; 

        return allyScore >= enemyScore;
    }

    static findPrimaryTarget(roomState) {
        const hostiles = roomState.hostiles;
        if (!hostiles || hostiles.length === 0) return null;

        let bestTarget = null;
        let highestScore = -Infinity;

        for (let i = 0; i < hostiles.length; i++) {
            const h = hostiles[i];
            let score = 0;

            let hasHeal = false;
            let hasAttack = false;

            for (let j = 0; j < h.body.length; j++) {
                const type = h.body[j].type;
                if (type === HEAL) hasHeal = true;
                if (type === ATTACK || type === RANGED_ATTACK) hasAttack = true;
            }

            // Target Priority System
            if (hasHeal) score += 1000;
            else if (hasAttack) score += 500;

            // Tie breaker: Weakest targets get prioritized (to burst them down)
            const healthRatio = h.hits / h.hitsMax;
            score -= healthRatio * 100;

            if (score > highestScore) {
                highestScore = score;
                bestTarget = h;
            }
        }

        return bestTarget;
    }

    static findBestRampart(creep, hostile, roomState, weAreStronger) {
        if (!roomState.ramparts || roomState.rampartCount === 0) return null;
        
        let bestRampart = null;
        let bestScore = -Infinity;
        
        const attackRange = (creep.memory.role === 'rangerCreep') ? 3 : 1;

        for (let i = 0; i < roomState.rampartCount; i++) {
            const s = roomState.ramparts[i];
            const distToHostile = Math.max(Math.abs(s.pos.x - hostile.pos.x), Math.abs(s.pos.y - hostile.pos.y));
            
            if (distToHostile <= attackRange) {
                const distToCreep = Math.max(Math.abs(creep.pos.x - s.pos.x), Math.abs(creep.pos.y - s.pos.y));
                const score = -distToCreep;
                if (score > bestScore) {
                    bestScore = score;
                    bestRampart = s;
                }
            }
        }
        
        if (!bestRampart && !weAreStronger) {
            let closestRampartToHostile = null;
            let minRampartDist = Infinity;
            for (let i = 0; i < roomState.rampartCount; i++) {
                const s = roomState.ramparts[i];
                const dist = Math.max(Math.abs(s.pos.x - hostile.pos.x), Math.abs(s.pos.y - hostile.pos.y));
                if (dist < minRampartDist) {
                    minRampartDist = dist;
                    closestRampartToHostile = s;
                }
            }
            if (closestRampartToHostile) bestRampart = closestRampartToHostile;
        }

        return bestRampart;
    }
}

module.exports = MilitaryManager;
