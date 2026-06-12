/**
 * Top-Down Intelligence Manager
 * Serializes visible room data to Memory and queues scouting targets.
 */
const ScoutingManager = require('./ScoutingManager');

const createRoomMemoryTemplate = () => ({
    scoutedAt: 0,
    roomType: 'core', // Enriches the global intel cache with structural map typings, allowing military and economic managers to make O(1) strategic decisions without redundant API calls.
    accessStatus: 'normal',
    sources: [], // Stores { id, x, y }
    mineral: null, // Stores { id, type, x, y }
    controller: { owner: null, level: 0, safeMode: 0, x: 0, y: 0 },
    droppedEnergy: 0,
    hostiles: { creeps: 0, towers: 0, invaderCore: false, dps: 0, hps: 0 }
});

class IntelManager {
    static run() {
        if (!Memory.rooms) {
            Memory.rooms = {};
        }

        if (!Memory.rooms) {
            Memory.rooms = {};
        }

        IntelManager.processObservers();

        const visibleRooms = Object.keys(Game.rooms);

        // Update threat and energy levels for all visible rooms EVERY TICK
        for (let i = 0; i < visibleRooms.length; i++) {
            const room = Game.rooms[visibleRooms[i]];
            IntelManager.updateThreatAndEnergy(room);

            // Passive Scraping: instantly grab data if unscouted or stale
            const mem = Memory.rooms[room.name];
            if (!mem || !mem.scoutedAt || (Game.time - mem.scoutedAt > 500)) {
                IntelManager.scanAndSave(room);
            }
        }

        if (Game.cpu.bucket <= 500) return;
        // Run every 10 ticks to save CPU
        if (Game.time % 10 !== 0) return;

        for (let i = 0; i < visibleRooms.length; i++) {
            const room = Game.rooms[visibleRooms[i]];
            IntelManager.scanAndSave(room);
            if (room.controller && room.controller.my && room.controller.level >= 3) {
                IntelManager.evaluateOutposts(room);
            }
        }

        global.State.scoutQueue = IntelManager.buildScoutQueue(visibleRooms);
    }

    static updateThreatAndEnergy(room) {
        if (!Memory.rooms) Memory.rooms = {};
        let mem = Memory.rooms[room.name];
        if (!mem) return;

        const state = global.State.rooms.get(room.name);
        if (!state) return;

        if (!mem.hostiles) mem.hostiles = { creeps: 0, towers: 0, invaderCore: false, dps: 0, hps: 0 };

        const hostileCreeps = state.hostiles || [];
        const towers = state.towers || [];
        let hostileTowerCount = 0;
        let totalDps = 0;
        let totalHps = 0;
        
        for (let i = 0; i < towers.length; i++) {
            if (!towers[i].my && towers[i].structureType === STRUCTURE_TOWER) {
                hostileTowerCount++;
                totalDps += 600;
                totalHps += 400;
            }
        }
        const invaderCores = state.invaderCores || [];
        
        for (let i = 0; i < hostileCreeps.length; i++) {
            const creep = hostileCreeps[i];
            const body = creep.body;
            if (body) {
                for (let j = 0; j < body.length; j++) {
                    const type = body[j].type;
                    if (type === ATTACK) totalDps += 30;
                    else if (type === RANGED_ATTACK) totalDps += 10;
                    else if (type === HEAL) totalHps += 12;
                }
            }
        }

        mem.hostiles.creeps = hostileCreeps.length;
        mem.hostiles.towers = hostileTowerCount;
        mem.hostiles.invaderCore = invaderCores.length > 0;
        mem.hostiles.dps = totalDps;
        mem.hostiles.hps = totalHps;

        const drops = state.droppedEnergy || [];
        let totalDrops = 0;
        for (let i = 0; i < drops.length; i++) {
            totalDrops += drops[i].amount;
        }
        mem.droppedEnergy = totalDrops;
    }

    static scanAndSave(room) {
        if (!Memory.rooms) {
            Memory.rooms = {};
        }

        let mem = Memory.rooms[room.name];
        if (!mem) {
            mem = createRoomMemoryTemplate();
            Memory.rooms[room.name] = mem;
        }

        mem.scoutedAt = Game.time;

        if (ScoutingManager.isHighway(room.name)) mem.roomType = 'highway';
        else if (ScoutingManager.isKeeperRoom(room.name)) mem.roomType = 'sk';
        else mem.roomType = 'core';

        const status = Game.map.getRoomStatus(room.name);
        mem.accessStatus = status ? status.status : 'normal';

        // Ensure nested objects exist in case of schema updates on existing memory
        if (!mem.controller) mem.controller = { owner: null, level: 0, safeMode: 0, x: 0, y: 0 };
        if (!mem.hostiles) mem.hostiles = { creeps: 0, towers: 0, invaderCore: false, dps: 0, hps: 0 };

        const state = global.State.rooms.get(room.name);
        if (!state) return;

        // 1. Detailed Source Intelligence
        const sources = state.sources || [];
        const memSources = [];
        for (let i = 0; i < sources.length; i++) {
            memSources.push({
                id: sources[i].id,
                x: sources[i].pos.x,
                y: sources[i].pos.y
            });
        }
        mem.sources = memSources;

        // 2. Controller Intelligence
        const controllerObj = mem.controller;
        if (room.controller) {
            controllerObj.owner = room.controller.owner ? room.controller.owner.username : null;
            controllerObj.level = room.controller.level;
            controllerObj.safeMode = room.controller.safeMode || 0;
            controllerObj.x = room.controller.pos.x;
            controllerObj.y = room.controller.pos.y;
            if (room.controller.reservation) {
                controllerObj.reservation = {
                    username: room.controller.reservation.username,
                    ticksToEnd: room.controller.reservation.ticksToEnd
                };
            } else {
                controllerObj.reservation = null;
            }
        } else {
            controllerObj.owner = null;
            controllerObj.reservation = null;
        }

        // 3. Mineral Intelligence
        const mineral = state.mineral;
        if (mineral) {
            mem.mineral = {
                id: mineral.id,
                type: mineral.mineralType,
                x: mineral.pos.x,
                y: mineral.pos.y
            };
        } else {
            mem.mineral = null;
        }

        // 4. Hostile Threat Assessment
        const hostileCreeps = state.hostiles || [];
        const towers = state.towers || [];

        let hostileTowerCount = 0;
        for (let i = 0; i < towers.length; i++) {
            if (!towers[i].my && towers[i].structureType === STRUCTURE_TOWER) {
                hostileTowerCount++;
            }
        }

        const invaderCores = state.invaderCores || [];

        const hostilesObj = mem.hostiles;
        hostilesObj.creeps = hostileCreeps.length;
        hostilesObj.towers = hostileTowerCount;
        hostilesObj.invaderCore = invaderCores.length > 0;

        // 5. Scavenging Data
        const drops = state.droppedEnergy || [];
        let totalDrops = 0;
        for (let i = 0; i < drops.length; i++) {
            totalDrops += drops[i].amount;
        }
        mem.droppedEnergy = totalDrops;
    }

    static buildScoutQueue(visibleRooms) {
        if (!Memory.rooms) {
            Memory.rooms = {};
        }

        const queue = [];
        for (let i = 0; i < visibleRooms.length; i++) {
            const exits = Game.map.describeExits(visibleRooms[i]);
            if (!exits) continue;

            const exitRooms = Object.values(exits);
            for (let j = 0; j < exitRooms.length; j++) {
                const adjRoom = exitRooms[j];
                const mem = Memory.rooms[adjRoom];
                // Reduced from 5000 to 3000. Hostile data goes stale fast.
                if (!mem || (Game.time - mem.scoutedAt > 3000)) {
                    if (!queue.includes(adjRoom)) {
                        queue.push(adjRoom);
                    }
                }
            }
        }
        return queue;
    }

    static processObservers() {
        if (!global.State || !global.State.colonies) return;
        if (!global.Cache.observerQueues) global.Cache.observerQueues = {};

        for (const colony of global.State.colonies.values()) {
            const roomState = global.State.rooms.get(colony.name);
            if (!roomState || !roomState.observers || roomState.observers.length === 0) continue;

            const observer = roomState.observers[0];
            const queueKey = colony.name;

            // Generate Queue if empty
            if (!global.Cache.observerQueues[queueKey] || global.Cache.observerQueues[queueKey].length === 0) {
                global.Cache.observerQueues[queueKey] = IntelManager.generateObserverQueue(colony.name);
            }

            const queue = global.Cache.observerQueues[queueKey];
            if (queue.length > 0) {
                // Find next target needing scouting
                let targetScouted = true;
                let targetRoom = null;

                while (targetScouted && queue.length > 0) {
                    targetRoom = queue.shift(); // take from front
                    const mem = Memory.rooms[targetRoom];
                    // If unscouted or older than 5000 ticks, it's a valid target
                    if (!mem || !mem.scoutedAt || (Game.time - mem.scoutedAt > 5000)) {
                        targetScouted = false;
                    }
                }

                if (!targetScouted && targetRoom) {
                    observer.observeRoom(targetRoom);
                    // Push to back of queue so we eventually cycle through all again
                    queue.push(targetRoom);
                }
            }
        }
    }

    static generateObserverQueue(centerRoomName) {
        const queue = [];
        const match = centerRoomName.match(/^([WE])(\d+)([NS])(\d+)$/);
        if (!match) return queue;

        let wx = parseInt(match[2]);
        let wy = parseInt(match[4]);
        if (match[1] === 'W') wx = ~wx;
        if (match[3] === 'S') wy = ~wy;

        for (let dx = -10; dx <= 10; dx++) {
            for (let dy = -10; dy <= 10; dy++) {
                if (dx === 0 && dy === 0) continue;
                const tx = wx + dx;
                const ty = wy + dy;

                const p1 = tx < 0 ? 'W' + (~tx) : 'E' + tx;
                const p2 = ty < 0 ? 'S' + (~ty) : 'N' + ty;
                const targetName = p1 + p2;

                // Ensure it exists on the map
                if (Game.map.getRoomStatus(targetName).status === 'normal') {
                    queue.push(targetName);
                }
            }
        }
        return queue;
    }

    static evaluateOutposts(room) {
        if (!Memory.outposts) Memory.outposts = {};

        const exits = Game.map.describeExits(room.name);
        const outposts = [];
        for (const dir in exits) {
            const adjRoom = exits[dir];
            const intel = Memory.rooms[adjRoom];
            if (!intel) continue;

            // Check if suitable for remote mining
            if (intel.controller && intel.controller.owner) continue; // Owned by someone
            if (intel.hostiles && (intel.hostiles.towers > 0 || intel.hostiles.invaderCore)) continue; // Hostile structures
            
            // SK rooms are only viable at RCL 6+ due to heavy military requirements
            if (intel.roomType === 'sk' && (!room.controller || room.controller.level < 6)) continue;

            if (intel.sources && intel.sources.length > 0) {
                outposts.push(adjRoom);
                // Register globally
                Memory.outposts[adjRoom] = { sourceRoom: room.name, sources: intel.sources.length, roomType: intel.roomType };
            }
        }

        // Save to our room's memory
        room.memory.outposts = outposts;
    }
}

module.exports = IntelManager;