const { markMemoryDirty, registerIntent, safeSuicide } = require('./state');
// src/harvesters.js
// Top-Down Zero-Pathing Stationary Mining, Birth Source Locking & In-Place Container Maintenance
const { calcDistance } = require('./constants');
const { moveCreep } = require('./traffic');

function creepsByRole(roomName, roles) {
    const col = global.heap && global.heap.colonies ? global.heap.colonies[roomName] : null;
    const state = global.heap && global.heap.rooms ? global.heap.rooms[roomName] : null;
    if (roles.length === 1) {
        const role = roles[0];
        const colArr = col && col.creepsByRole ? col.creepsByRole[role] : null;
        if (colArr && colArr.length > 0) return colArr;
        const stArr = state && state.creepsByRole ? state.creepsByRole[role] : null;
        if (stArr && stArr.length > 0) return stArr;
        return [];
    }
    const byRole = (col && col.creepsByRole) || (state && state.creepsByRole) || null;
    if (byRole) {
        let combined = [];
        for (let i = 0; i < roles.length; i++) {
            const arr = (col && col.creepsByRole && col.creepsByRole[roles[i]] && col.creepsByRole[roles[i]].length > 0)
                ? col.creepsByRole[roles[i]]
                : (state && state.creepsByRole ? state.creepsByRole[roles[i]] : null);
            if (arr && arr.length) combined = combined.concat(arr);
        }
        return combined;
    }
    const out = [];
    for (const name in Game.creeps) {
        const c = Game.creeps[name];
        if (c.memory && c.memory.colony === roomName && roles.indexOf(c.memory.role) !== -1) {
            out.push(c);
        }
    }
    return out;
}

function countOpenSpots(source, roomName) {
    if (!source || !source.pos) return 1;
    const state = global.heap && global.heap.rooms ? global.heap.rooms[roomName] : null;
    if (state && state.sourceSpots && state.sourceSpots[source.id]) {
        return Math.max(1, state.sourceSpots[source.id].length);
    }
    const terrain = Game.map.getRoomTerrain(roomName);
    let count = 0;
    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
            if (dx === 0 && dy === 0) continue;
            const x = source.pos.x + dx;
            const y = source.pos.y + dy;
            if (x > 0 && x < 49 && y > 0 && y < 49 && terrain.get(x, y) !== TERRAIN_MASK_WALL) {
                count++;
            }
        }
    }
    return Math.max(1, count);
}

function runHarvesters(roomName) {
    const state = global.heap && global.heap.rooms ? global.heap.rooms[roomName] : null;
    if (!state) return;
    const room = Game.rooms[roomName];
    if (!room) return;

    const miners = creepsByRole(roomName, ['harvester']);
    if (!miners.length) return;

    const sources = state.sources || [];
    if (!sources.length) return;

    const spots = {};
    for (let s = 0; s < sources.length; s++) {
        spots[sources[s].id] = countOpenSpots(sources[s], roomName);
    }

    const rcl = room.controller ? room.controller.level : 1;
    const maxPerSource = rcl >= 2 ? 1 : 2;

    const taken = {};
    const activeTaken = {};
    const seatedOnSource = {};
    for (let i = 0; i < miners.length; i++) {
        const c = miners[i];
        const sId = (c.memory && c.memory.sourceId) || (c.heap && c.heap.sourceId);
        if (sId) {
            taken[sId] = (taken[sId] || 0) + 1;
            if (c.ticksToLive === undefined || c.ticksToLive >= 60) {
                activeTaken[sId] = (activeTaken[sId] || 0) + 1;
            }
            if (c.heap && c.heap.inPosition) {
                seatedOnSource[sId] = (seatedOnSource[sId] || 0) + 1;
            }
            if (c.heap) c.heap.sourceId = sId;
        }
    }

    const unassignedSourceExists = sources.some(src => (taken[src.id] || 0) === 0);
    const retainedOnSource = {};

    for (let i = 0; i < miners.length; i++) {
        const creep = miners[i];
        if (creep.spawning) continue;
        if (!creep.heap) creep.heap = {};
        const heap = creep.heap;

        if (heap.sleepUntil && Game.time < heap.sleepUntil) continue;

        // Deterministic Source Locking with self-healing rebalancing if multiple active miners stacked onto one source while another is unmined
        let memSrc = (creep.memory && creep.memory.sourceId) || heap.sourceId;
        if (memSrc && unassignedSourceExists && (activeTaken[memSrc] || 0) > maxPerSource && (creep.ticksToLive === undefined || creep.ticksToLive >= 60)) {
            const canRelease = !heap.inPosition || ((seatedOnSource[memSrc] || 0) > maxPerSource && (retainedOnSource[memSrc] || 0) >= maxPerSource);
            if (canRelease && (heap.inPosition || (seatedOnSource[memSrc] || 0) > 0 || (retainedOnSource[memSrc] || 0) >= maxPerSource)) {
                taken[memSrc] = Math.max(0, (taken[memSrc] || 1) - 1);
                activeTaken[memSrc] = Math.max(0, (activeTaken[memSrc] || 1) - 1);
                if (heap.inPosition) seatedOnSource[memSrc] = Math.max(0, (seatedOnSource[memSrc] || 1) - 1);
                memSrc = null;
                if (creep.memory) {
                    creep.memory.sourceId = null;
                    markMemoryDirty();
                }
                heap.sourceId = null;
                heap.inPosition = false;
            }
        }
        if (memSrc) {
            heap.sourceId = memSrc;
            retainedOnSource[memSrc] = (retainedOnSource[memSrc] || 0) + 1;
        }
        if (!heap.sourceId) {
            let bestSrc = null;
            let minAssigned = Infinity;
            for (let s = 0; s < sources.length; s++) {
                const src = sources[s];
                const assigned = taken[src.id] || 0;
                const limit = Math.min(spots[src.id] || 1, maxPerSource);
                if (assigned < limit && assigned < minAssigned) {
                    minAssigned = assigned;
                    bestSrc = src;
                }
            }
            if (!bestSrc && sources.length > 0) {
                bestSrc = sources.reduce((best, s) => ((taken[s.id] || 0) < (taken[best.id] || 0) ? s : best), sources[0]);
            }
            if (bestSrc) {
                heap.sourceId = bestSrc.id;
                if (creep.memory) {
                    creep.memory.sourceId = bestSrc.id;
                    markMemoryDirty();
                }
                taken[bestSrc.id] = (taken[bestSrc.id] || 0) + 1;
            }
        }

        const source = Game.getObjectById(heap.sourceId);
        if (!source) continue;

        // Use O(1) pre-scanned containerBySource lookup from state.js
        const container = (state.containerBySource && state.containerBySource[source.id])
            || (state.containers ? state.containers.find(cnt => calcDistance(cnt.pos, source.pos) <= 1) : null);
        const sites = state.constructionSites || [];
        const containerSite = !container
            ? sites.find(cs => cs.structureType === STRUCTURE_CONTAINER && calcDistance(cs.pos, source.pos) <= 1)
            : null;

        // Target spot: stand directly on container if present, else any open range-1 tile adjacent to source
        const targetPos = container ? container.pos : source.pos;
        const targetRange = container ? 0 : 1;
        const distToTarget = calcDistance(creep.pos, targetPos);

        // Zero-Pathing Stationary Mining: only invoke moveCreep when out of position (and not fatigued)
        if (distToTarget > targetRange) {
            heap.inPosition = false;
            if (creep.fatigue === 0) moveCreep(creep, targetPos, targetRange);
            continue;
        }
        heap.inPosition = true;
        heap.nextStep = null;

        const carried = creep.store ? (creep.store[RESOURCE_ENERGY] || 0) : 0;
        const freeCap = creep.store ? creep.store.getFreeCapacity(RESOURCE_ENERGY) : 0;

        // Zero-Downtime Station Handover: If dying (< 35 TTL) and replacement has arrived, transfer and suicide
        if (creep.ticksToLive !== undefined && creep.ticksToLive < 35) {
            const replacement = miners.find(m => m.id !== creep.id && !m.spawning && ((m.memory && m.memory.sourceId === heap.sourceId) || (m.heap && m.heap.sourceId === heap.sourceId)) && calcDistance(m.pos, creep.pos) <= 1);
            if (replacement) {
                const handoverLink = (state.links || []).find(l => calcDistance(creep.pos, l.pos) <= 1 && l.store && l.store.getFreeCapacity(RESOURCE_ENERGY) > 0);
                if (handoverLink && carried > 0) {
                    creep.transfer(handoverLink, RESOURCE_ENERGY);
                } else if (container && container.store && container.store.getFreeCapacity(RESOURCE_ENERGY) > 0 && carried > 0) {
                    creep.transfer(container, RESOURCE_ENERGY);
                } else if (carried > 0) {
                    creep.drop(RESOURCE_ENERGY);
                }
                safeSuicide(creep, 'station_handover');
                continue;
            }
        }

        if (source.energy === 0) {
            heap.sleepUntil = Game.time + (source.ticksToRegeneration || 300);
            continue;
        }

        // 1. Transfer energy into adjacent Source Link first (RCL 5+), else passive overflow into container if standing on it, else Container/Spawn/Hauler!
        const adjLink = (state.links || []).find(l => calcDistance(creep.pos, l.pos) <= 1 && l.store && l.store.getFreeCapacity(RESOURCE_ENERGY) > 0);
        const onContainer = !!(container && creep.pos.x === container.pos.x && creep.pos.y === container.pos.y);
        if (adjLink && carried > 0 && (freeCap < 20 || carried >= 40)) {
            creep.transfer(adjLink, RESOURCE_ENERGY);
            registerIntent(creep, 'transfer', adjLink, carried);
        } else if (!onContainer && container && container.store && container.store.getFreeCapacity(RESOURCE_ENERGY) > 0 && carried >= 30) {
            creep.transfer(container, RESOURCE_ENERGY);
            registerIntent(creep, 'transfer', container, carried);
        } else if (!container && carried > 0 && freeCap <= 10) {
            const adjSpawn = (state.spawns || []).find(sp => calcDistance(creep.pos, sp.pos) <= 1 && sp.store && sp.store.getFreeCapacity(RESOURCE_ENERGY) > 0);
            if (adjSpawn) {
                creep.transfer(adjSpawn, RESOURCE_ENERGY);
                registerIntent(creep, 'transfer', adjSpawn, carried);
            } else {
                const haulers = creepsByRole(roomName, ['hauler']);
                const adjHauler = haulers.find(h => calcDistance(creep.pos, h.pos) <= 1 && h.store && h.store.getFreeCapacity(RESOURCE_ENERGY) > 0);
                if (adjHauler) {
                    creep.transfer(adjHauler, RESOURCE_ENERGY);
                    registerIntent(creep, 'transfer', adjHauler, carried);
                } else if (!containerSite) {
                    creep.drop(RESOURCE_ENERGY);
                }
            }
        }

        // 2. Work slot: repair/build container when needed, else harvest source continuously
        let didWork = false;
        if (container && container.hits < container.hitsMax * 0.70 && carried >= 30) {
            didWork = (creep.repair(container) === OK);
            if (didWork) heap.actionIntent = 'repair';
        } else if (containerSite && freeCap <= 10) {
            didWork = (creep.build(containerSite) === OK);
            if (didWork) heap.actionIntent = 'build';
        }

        if (!didWork) {
            heap.actionIntent = 'harvest';
            creep.harvest(source);
        }
    }

    // 5. Mineral Extraction at RCL >= 6: stationary extraction into container/storage
    const mineralMiners = creepsByRole(roomName, ['mineralminer', 'mineralMiner']);
    const mineral = state.mineral;
    if (mineralMiners.length && mineral && mineral.mineralAmount > 0) {
        const extractor = state.extractor || null;
        if (extractor) {
            for (let i = 0; i < mineralMiners.length; i++) {
                const mm = mineralMiners[i];
                if (mm.spawning) continue;
                if (!mm.heap) mm.heap = {};
                if (mm.heap.sleepUntil && Game.time < mm.heap.sleepUntil) continue;
                if (mineral.cooldown > 0) {
                    mm.heap.sleepUntil = Game.time + mineral.cooldown;
                    continue;
                }
                const minCont = (state.containers || []).find(c => calcDistance(c.pos, mineral.pos) <= 1);
                const targetPos = minCont ? minCont.pos : mineral.pos;
                if (calcDistance(mm.pos, mineral.pos) > 1) {
                    if (mm.fatigue === 0) moveCreep(mm, targetPos, minCont ? 0 : 1);
                    continue;
                }
                mm.harvest(mineral);
                const carried = mm.store ? mm.store.getUsedCapacity(mineral.mineralType) : 0;
                if (minCont && carried > 20 && minCont.store && minCont.store.getFreeCapacity() > 0) {
                    mm.transfer(minCont, mineral.mineralType);
                } else if (!minCont && mm.store && mm.store.getFreeCapacity() === 0) {
                    mm.drop(mineral.mineralType);
                }
            }
        }
    }
}

function closest(pos, list) {
    let best = null, bd = Infinity;
    for (let i = 0; i < list.length; i++) {
        const d = calcDistance(pos, list[i].pos || list[i]);
        if (d < bd) { bd = d; best = list[i]; }
    }
    return best;
}

module.exports = {
    closest,
    countOpenSpots,
    creepsByRole,
    runHarvesters
};