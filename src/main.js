// src/main.js
// Master Tick Loop, RawMemory Cache & Colony-Scoped 16-Module Flat Functional Pipeline

const { cleanupMemory, evaluateColonyHealth, flushSegmentPager, getExecutionMode, registerTaskHandler, reportSubsystemError, runTasks, scanGlobalState, scheduleTask } = require('./state');
const { formatSettings, getConfig, getRampartBaseline, hydrateConfig, isOffenseAllowed, log, resetConfig, setConfig } = require('./config');
const { runSpawning } = require('./spawning');
const { runHarvesters } = require('./harvesters');
const { runLogistics, runLinks } = require('./logistics');
const { runWorkers } = require('./workers');
const { resolveAllTraffic } = require('./traffic');
const { getRoomBlueprint, placeBunkerSites, rebakeRoomRoads, reconcileBunkerLayout, runPhoenixStateMachine } = require('./bunker');
const { planRoadNetwork } = require('./roads');
const { partitionEmpireOutposts, planOutposts, selectSiegeTarget, runObserver } = require('./remotes');
const { runFactory, runLabs, runMarket, runTerminal } = require('./labs_market');
const { runDefense, runPowerSpawn } = require('./defense');
const { runPowerCreeps } = require('./power_creeps');
const { runOffense } = require('./offense');
const { planMincutRamparts } = require('./mincut');
const { runQuadSquad } = require('./combat_quads');

function initConsoleCommands() {
    if (typeof global === 'undefined') return;

    global.imperial = {
        help() {
            return [
                '================================================================================',
                '                  IMPERIAL HIGH COMMAND TERMINAL INTERFACE                      ',
                '================================================================================',
                '  imperial.status()               - Full Sector Overview (Citadels, Shields, Legion)',
                '  imperial.isb()                  - Imperial Security Bureau Dossier & Rival Intel',
                '  imperial.ironFist(target)       - Authorize an Imperial Strike Directive on targetRoom',
                '  imperial.shield(roomName)       - Planetary Shield & Fortification Integrity Audit',
                '  imperial.logistics()            - Imperial Supply Corps (Highways, Links, Storages)',
                '  imperial.expansion()            - Strategic Colonization Dossier (2-Source Non-Adjacent Hubs)',
                '  imperial.probe(target)          - Dispatch Imperial Probe Droid reconnaissance',
                '  warRoom.analyze(roomName)       - Real-time combat analysis & Turbolaser net DPS',
                '  attack(targetRoom)              - Launch 2x2 combat quad raid on targetRoom',
                '  drain(targetRoom, safeRoom)     - Order border tower drainer against targetRoom',
                '  siege(targetRoom)               - Order team wreckers to dismantle targetRoom',
                '  praise(targetRoom)              - Designate targetRoom as Praiseroom for GCL boost',
                '  addOutpost(colony, outpost)     - Attach an outpost to an imperial citadel',
                '  removeOutpost(colony, outpost)  - Detach an outpost from citadel',
                '  imperial.flushMemory()          - Force immediate flush of heap state to RawMemory',
                '  imperial.settings()             - Display live Imperial Settings Menu',
                '  imperial.set(keyPath, value)    - Update a setting (e.g. imperial.set("remotesByRcl.6", 2))',
                '  imperial.posture(mode)          - Set military posture ("passive" | "defensive" | "hostile")',
                '  imperial.resetConfig(keyPath?)  - Reset one setting, subtree, or entire config to defaults',
                '================================================================================'
            ].join('\n');
        },
        settings() {
            return formatSettings();
        },
        set(keyPath, value) {
            const res = setConfig(keyPath, value);
            return res.ok ? `✔ ${res.path} = ${JSON.stringify(res.value)}` : res.error;
        },
        posture(mode) {
            const res = setConfig('posture', mode);
            return res.ok ? `✔ posture = ${JSON.stringify(res.value)}` : res.error;
        },
        resetConfig(keyPath) {
            const res = resetConfig(keyPath);
            return res.ok ? `✔ reset ${res.path} to defaults` : res.error;
        },
        flushMemory() {
            if (typeof RawMemory !== 'undefined' && RawMemory.set) {
                const s = (global.heap && global.heap.state) ? global.heap.state : (typeof Memory !== 'undefined' ? Memory : {});
                RawMemory.set(JSON.stringify(s));
                delete RawMemory._parsed;
                if (global.heap) global.heap.memoryDirty = false;
                return 'Memory flushed to RawMemory successfully.';
            }
            return 'RawMemory unavailable.';
        },
        rebakeRoads(roomName) {
            const heap = global.heap || {};
            let targets = [];
            if (roomName) {
                targets = [roomName];
            } else if (heap.colonies && Object.keys(heap.colonies).length > 0) {
                targets = Object.keys(heap.colonies);
            } else if (typeof Game !== 'undefined' && Game.rooms) {
                targets = Object.keys(Game.rooms).filter(n => Game.rooms[n].controller && Game.rooms[n].controller.my);
            }
            if (targets.length === 0) return 'No owned colonies available to rebake.';
            const results = [];
            for (let i = 0; i < targets.length; i++) {
                const res = rebakeRoomRoads(targets[i]);
                if (res) results.push(`${res.roomName}: ${res.roadCount} GRID_ROAD cells (v${res.version})`);
            }
            return results.length > 0 ? results.join(' | ') : 'Rebake completed with no results.';
        },
        rebuildLayouts(roomName) {
            const heap = global.heap || {};
            let targets = [];
            if (roomName) {
                targets = [roomName];
            } else if (heap.colonies && Object.keys(heap.colonies).length > 0) {
                targets = Object.keys(heap.colonies);
            } else if (typeof Game !== 'undefined' && Game.rooms) {
                targets = Object.keys(Game.rooms).filter(n => Game.rooms[n].controller && Game.rooms[n].controller.my);
            }
            if (targets.length === 0) return 'No owned colonies available to rebuild.';
            const results = [];
            for (let i = 0; i < targets.length; i++) {
                const rName = targets[i];
                const rebake = rebakeRoomRoads(rName);
                const room = typeof Game !== 'undefined' && Game.rooms ? Game.rooms[rName] : null;
                const roomState = heap.rooms ? heap.rooms[rName] : null;
                let stats = null;
                if (room) {
                    const bp = getRoomBlueprint(room);
                    stats = reconcileBunkerLayout(room, roomState, bp, { force: true });
                    placeBunkerSites(room);
                }
                const destroyedSum = stats
                    ? (stats.destroyedBlockingRoads + stats.destroyedStrayRoads + stats.destroyedExtensions + stats.destroyedTowers + stats.destroyedSingletons + stats.destroyedContainers + stats.destroyedSpawns)
                    : 0;
                results.push(`${rName}: ${rebake ? rebake.roadCount : '?'} roads (v${rebake ? rebake.version : '?'}), decommissioned=${destroyedSum}`);
            }
            return results.join(' | ');
        },
        status() {
            const heap = global.heap || {};
            const colonies = heap.colonies || {};
            const isb = (typeof Memory !== 'undefined' && Memory.empire && Memory.empire.isb) || {};
            const shields = isb.planetaryShields || {};
            const lines = [
                '================================================================================',
                `  IMPERIAL HIGH COMMAND - SECTOR STATUS (Tick ${Game.time} | Bucket: ${Game.cpu ? Game.cpu.bucket : 'N/A'})`,
                '================================================================================',
                '[CITADELS & PLANETARY SHIELDS]'
            ];
            for (const cName in colonies) {
                const room = Game.rooms[cName];
                const rcl = room && room.controller ? room.controller.level : '?';
                const storage = room && room.storage ? (room.storage.store[RESOURCE_ENERGY] || 0) : 0;
                const creeps = (heap.rooms && heap.rooms[cName] && heap.rooms[cName].creeps) ? heap.rooms[cName].creeps.length : 0;
                const sh = shields[cName] || {};
                const shStatus = sh.status || 'UNAUDITED';
                const shPct = sh.shieldIntegrityPct !== undefined ? `${sh.shieldIntegrityPct}%` : 'N/A';
                const minH = sh.minHits ? sh.minHits.toLocaleString() : '0';
                const tgtH = sh.targetHits ? sh.targetHits.toLocaleString() : 'N/A';
                lines.push(`  Citadel ${cName}: RCL ${rcl} | Storage: ${storage.toLocaleString()}e | Shield: ${shStatus} (${shPct}, Min: ${minH}/${tgtH}) | Garrison: ${creeps}`);
            }
            lines.push('[ISB SURVEILLANCE & RIVAL FACTIONS]');
            const factions = isb.factions || {};
            const fKeys = Object.keys(factions);
            if (fKeys.length > 0) {
                for (let k = 0; k < fKeys.length; k++) {
                    const f = factions[fKeys[k]];
                    lines.push(`  Rival ${f.faction}: [${f.threatTier}] | Controlled: ${f.systemsControlled} systems | Peak DPS: ${f.peakDPS} | Turbolasers: ${f.towersTotal} | Outposts: ${f.outposts.join(', ') || 'None'}`);
                }
            } else {
                lines.push('  No rival player factions currently posing an immediate threat to the sector.');
            }
            const interdict = isb.interdictionTargets || [];
            if (interdict.length > 0) {
                lines.push(`  Active Iron Fist Interdiction Targets: ${interdict.join(', ')}`);
            }
            lines.push('[IMPERIAL SUPPLY CORPS]');
            lines.push(`  Known Systems Monitored: ${isb.knownSystems || Object.keys(heap.remoteRooms || {}).length} | Active Threats: ${isb.activeThreats || 0}`);
            lines.push('================================================================================');
            return lines.join('\n');
        },
        isb() {
            const isb = (typeof Memory !== 'undefined' && Memory.empire && Memory.empire.isb) || {};
            const factions = isb.factions || {};
            const surv = (typeof Memory !== 'undefined' && Memory.empire && Memory.empire.surveillance) || [];
            const lines = [
                '================================================================================',
                `  IMPERIAL SECURITY BUREAU (ISB) - SECTOR DOSSIER (Last Sweep: ${isb.lastSweep || Game.time})`,
                '================================================================================',
                `Total Systems Monitored: ${isb.knownSystems || 0} | Active Threat Situations: ${isb.activeThreats || 0}`,
                '--- RIVAL PLAYER FACTIONS ---'
            ];
            const fKeys = Object.keys(factions);
            if (fKeys.length === 0) {
                lines.push('  No hostile player factions detected within surveillance perimeter.');
            } else {
                for (let i = 0; i < fKeys.length; i++) {
                    const f = factions[fKeys[i]];
                    lines.push(`  [${f.threatTier}] Faction: ${f.faction}`);
                    lines.push(`    Systems: ${f.systemsControlled} (${f.outposts.join(', ') || 'none'})`);
                    lines.push(`    Turbolasers (Towers): ${f.towersTotal} | Peak Incoming DPS: ${f.peakDPS} | Peak HPS: ${f.peakHPS}`);
                }
            }
            lines.push('--- TOP TACTICAL SURVEILLANCE RECORDS ---');
            for (let s = 0; s < Math.min(6, surv.length); s++) {
                const sv = surv[s];
                lines.push(`  System ${sv.roomName}: Allegiance: ${sv.owner} | Threat: ${sv.threatLevel} | Enemy DPS: ${sv.enemyDPS} | Towers: ${sv.towers} | Breach Needed: ~${sv.breachDPSNeeded} DPS`);
            }
            lines.push('================================================================================');
            return lines.join('\n');
        },
        ironFist(targetRoom) {
            if (!isOffenseAllowed('raider')) {
                return `Refused: posture is '${getConfig().posture}'. Run imperial.posture('hostile') first.`;
            }
            if (!targetRoom) return 'Usage: imperial.ironFist("W1N2")';
            if (!Memory.empire) Memory.empire = {};
            if (!Memory.empire.enemyOutposts) Memory.empire.enemyOutposts = [];
            if (!Memory.empire.enemyOutposts.some(e => e.roomName === targetRoom)) {
                Memory.empire.enemyOutposts.push({ roomName: targetRoom, orderedAt: Game.time });
            }
            return `[IRON FIST] Strike directive issued for System ${targetRoom}. Imperial strike raiders and combat columns dispatched to subjugate the sector.`;
        },
        shield(roomName) {
            const heap = global.heap || {};
            if (!roomName) {
                const cols = Object.keys(heap.colonies || {});
                if (!cols.length) return 'No active citadels to audit.';
                roomName = cols[0];
            }
            const room = Game.rooms[roomName];
            if (!room) return `Citadel ${roomName} is not currently visible.`;
            const rcl = room.controller ? room.controller.level : 1;
            const targetHits = getRampartBaseline(rcl);
            const rState = heap.rooms ? heap.rooms[roomName] : null;
            const ramparts = (rState && rState.ramparts) || (room.find ? room.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_RAMPART && s.my }) : []);
            const lowest = ramparts.length > 0 ? ramparts.reduce((min, r) => (r.hits < min.hits ? r : min), ramparts[0]) : null;
            const avg = ramparts.length > 0 ? Math.round(ramparts.reduce((sum, r) => sum + r.hits, 0) / ramparts.length) : 0;
            const breaches = ramparts.filter(r => r.hits < Math.min(5000, targetHits));
            return [
                `--- CITADEL ${roomName} PLANETARY SHIELD AUDIT ---`,
                `  Shield Perimeter Nodes (Ramparts): ${ramparts.length}`,
                `  Integrity Target: ${targetHits.toLocaleString()} hits`,
                `  Weakest Shield Point: ${lowest ? `${lowest.hits.toLocaleString()} hits at (${lowest.pos.x},${lowest.pos.y})` : 'None'}`,
                `  Average Shield Integrity: ${avg.toLocaleString()} hits`,
                `  Critical Shield Breaches: ${breaches.length} points require emergency fortification`
            ].join('\n');
        },
        logistics() {
            const heap = global.heap || {};
            const colonies = heap.colonies || {};
            const lines = ['--- IMPERIAL SUPPLY CORPS AUDIT ---'];
            for (const cName in colonies) {
                const room = Game.rooms[cName];
                if (!room) continue;
                const rState = heap.rooms ? heap.rooms[cName] : null;
                const storage = room.storage ? (room.storage.store[RESOURCE_ENERGY] || 0) : 0;
                const links = rState ? (rState.links || []) : [];
                const roads = rState ? (rState.roads || []) : [];
                const damagedRoads = roads.filter(r => r.hits < r.hitsMax * 0.6);
                lines.push(`  Citadel ${cName}: Storage ${storage.toLocaleString()}e | Links: ${links.length} | Roads: ${roads.length} (${damagedRoads.length} need maintenance)`);
            }
            return lines.join('\n');
        },
        probe(targetRoom) {
            if (!targetRoom) return 'Usage: imperial.probe("W1N2")';
            if (!Memory.empire) Memory.empire = {};
            if (!Memory.empire.probeRequests) Memory.empire.probeRequests = [];
            if (!Memory.empire.probeRequests.includes(targetRoom)) {
                Memory.empire.probeRequests.push(targetRoom);
            }
            return `[ISB] Imperial Probe Droid reconnaissance vector plotted for System ${targetRoom}.`;
        },
        expansion() {
            const expTarget = (Memory.empire && Memory.empire.expansionTarget) || 'None';
            const expPoints = (Memory.empire && Memory.empire.expansionPoints) || [];
            const lines = [
                '--- IMPERIAL STRATEGIC COLONIZATION DOSSIER ---',
                `  Active Expansion Target: ${expTarget}`,
                '  Top Strategic Candidate Citadels (Ranked by 2-Source Quality, Distance Buffer & Outpost Halo):'
            ];
            if (expPoints.length === 0) {
                lines.push('    No candidates currently meet the 2-source non-adjacent imperial standard (scanning sector...)');
            } else {
                for (let i = 0; i < expPoints.length; i++) {
                    const p = expPoints[i];
                    lines.push(`    ${i + 1}. Room ${p.roomName}: Score ${p.score} | Distance: ${p.minDistance} rooms | Sources: ${p.sources} | Mineral: ${p.mineral || 'None'}`);
                }
            }
            return lines.join('\n');
        }
    };

    global.help = function() {
        return global.imperial.help();
    };

    global.status = function() {
        return global.imperial.status();
    };

    global.isb = function() {
        return global.imperial.isb();
    };

    global.expansion = function() {
        return global.imperial.expansion();
    };

    global.ironFist = function(targetRoom) {
        return global.imperial.ironFist(targetRoom);
    };

    global.warRoom = {
        analyze(roomName) {
            const heap = global.heap || {};
            const room = Game.rooms[roomName];
            if (!room) return `Room ${roomName} is not currently visible to our scouts/observers.`;
            const towers = room.find ? room.find(FIND_HOSTILE_STRUCTURES, { filter: s => s.structureType === STRUCTURE_TOWER }) : [];
            const activeTowers = towers.filter(t => t.isActive && t.isActive());
            const towerDPS = activeTowers.length * 600;
            const hostiles = room.find ? room.find(FIND_HOSTILE_CREEPS) : [];
            const armedHostiles = hostiles.filter(h => h.getActiveBodyparts && (h.getActiveBodyparts(ATTACK) > 0 || h.getActiveBodyparts(RANGED_ATTACK) > 0));
            const healers = hostiles.filter(h => h.getActiveBodyparts && h.getActiveBodyparts(HEAL) > 0);
            const totalEnemyHeal = healers.reduce((acc, h) => acc + h.getActiveBodyparts(HEAL) * 12, 0);
            const myCreeps = room.find ? room.find(FIND_MY_CREEPS) : [];
            const rState = heap.rooms ? heap.rooms[roomName] : null;
            const ramparts = (rState && rState.ramparts) || (room.find ? room.find(FIND_STRUCTURES, { filter: s => s.structureType === STRUCTURE_RAMPART }) : []);
            const lowestRampart = ramparts.length > 0 ? ramparts.reduce((min, r) => (r.hits < min.hits ? r : min), ramparts[0]) : null;

            return [
                `--- IMPERIAL WAR ROOM ANALYSIS: ${roomName} (Tick ${Game.time}) ---`,
                `  Active Turbolasers (Towers): ${activeTowers.length} (Peak Net Burst: ${towerDPS} DPS)`,
                `  Armed Hostiles: ${armedHostiles.length} | Enemy Healers: ${healers.length} (Total HPS: ${totalEnemyHeal})`,
                `  Planetary Shield Ramparts: ${ramparts.length} (Lowest Hits: ${lowestRampart ? lowestRampart.hits.toLocaleString() : 'None'})`,
                `  Breach DPS Needed: ~${towerDPS + totalEnemyHeal + 200} DPS`,
                `  Imperial Garrison Units Present: ${myCreeps.length} (${myCreeps.map(c => c.name).join(', ') || 'None'})`
            ].join('\n');
        }
    };

    global.attack = function(targetRoom) {
        return global.imperial.ironFist(targetRoom);
    };

    global.drain = function(targetRoom, safeRoom) {
        if (!isOffenseAllowed('drainer')) {
            return `Refused: posture is '${getConfig().posture}'. Run imperial.posture('hostile') first.`;
        }
        if (!targetRoom) return 'Usage: drain("W1N2", "W1N1")';
        if (!Memory.empire) Memory.empire = {};
        if (!Memory.empire.drainOperations) Memory.empire.drainOperations = {};
        Memory.empire.drainOperations[targetRoom] = { safeRoom: safeRoom || null, orderedAt: Game.time };
        return `[WAR] Tower drain operation initialized against ${targetRoom} via safe room ${safeRoom || 'auto'}.`;
    };

    global.siege = function(targetRoom) {
        if (!isOffenseAllowed('wrecker')) {
            return `Refused: posture is '${getConfig().posture}'. Run imperial.posture('hostile') first.`;
        }
        if (!targetRoom) return 'Usage: siege("W1N2")';
        if (!Memory.empire) Memory.empire = {};
        if (!Memory.empire.siegeOperations) Memory.empire.siegeOperations = {};
        Memory.empire.siegeOperations[targetRoom] = { orderedAt: Game.time };
        return `[WAR] Siege operation initialized against ${targetRoom}. Team wreckers queued!`;
    };

    global.praise = function(targetRoom) {
        if (!targetRoom) return 'Usage: praise("W1N2")';
        if (!Memory.empire) Memory.empire = {};
        Memory.empire.praiseRoom = targetRoom;
        return `[GCL] Praiseroom set to ${targetRoom}. Terminal energy shipments & boosted Praisers active!`;
    };

    global.stopPraise = function() {
        if (Memory.empire) delete Memory.empire.praiseRoom;
        return '[GCL] Praiseroom operations halted.';
    };

    global.addOutpost = function(colony, outpost) {
        if (!colony || !outpost) return 'Usage: addOutpost("W1N1", "W1N2")';
        if (!Memory.empire) Memory.empire = {};
        if (!Memory.empire.manualOutposts) Memory.empire.manualOutposts = {};
        Memory.empire.manualOutposts[outpost] = colony;
        partitionEmpireOutposts();
        return `Outpost ${outpost} manually attached to colony ${colony}.`;
    };

    global.removeOutpost = function(colony, outpost) {
        if (!colony || !outpost) return 'Usage: removeOutpost("W1N1", "W1N2")';
        if (Memory.empire && Memory.empire.manualOutposts && Memory.empire.manualOutposts[outpost]) {
            delete Memory.empire.manualOutposts[outpost];
        }
        if (Memory.rooms && Memory.rooms[colony] && Memory.rooms[colony].outposts) {
            const idx = Memory.rooms[colony].outposts.indexOf(outpost);
            if (idx !== -1) Memory.rooms[colony].outposts.splice(idx, 1);
        }
        partitionEmpireOutposts();
        return `Outpost ${outpost} removed from colony ${colony}.`;
    };
}

initConsoleCommands();

let _parsedMemory = null;
let _lastTime = 0;

// Phase profiler: per-phase CPU accumulated in heap, flushed to Memory.profiler every PROFILE_WINDOW ticks.
const PROFILE_WINDOW = 100;

function profileAdd(phaseName, cpu) {
    const h = global.heap;
    if (!h) return;
    const p = h.prof || (h.prof = { phases: {}, ticks: 0, tickSum: 0, tickMax: 0, bucketMin: 10000, start: Game.time });
    const e = p.phases[phaseName] || (p.phases[phaseName] = { sum: 0, max: 0, n: 0 });
    e.sum += cpu;
    e.n++;
    if (cpu > e.max) e.max = cpu;
}

function profileEndTick() {
    const h = global.heap;
    if (!h || !h.prof || !Game.cpu) return;
    const p = h.prof;
    const used = Game.cpu.getUsed();
    if (h.cpuMean50 === undefined) h.cpuMean50 = used;
    else h.cpuMean50 = h.cpuMean50 + (used - h.cpuMean50) * 0.02;
    p.ticks++;
    p.tickSum += used;
    if (used > p.tickMax) p.tickMax = used;
    if (Game.cpu.bucket < p.bucketMin) p.bucketMin = Game.cpu.bucket;
    if (p.ticks < PROFILE_WINDOW) return;

    const out = { tick: Game.time, window: p.ticks, mean: +(p.tickSum / p.ticks).toFixed(3), max: +p.tickMax.toFixed(2), bucketMin: p.bucketMin, phases: {} };
    for (const k in p.phases) {
        const e = p.phases[k];
        out.phases[k] = { avg: +(e.sum / p.ticks).toFixed(3), max: +e.max.toFixed(2) };
    }
    if (p.counters) {
        out.counters = {};
        for (const k in p.counters) out.counters[k] = +(p.counters[k] / p.ticks).toFixed(3);
    }
    if (typeof Memory !== 'undefined') Memory.profiler = out;
    h.memoryDirty = true;
    h.prof = null;
}

function runMaintenanceFallback(roomName) {
    const room = Game.rooms[roomName];
    if (!room) return;
    const creeps = (global.heap && global.heap.rooms && global.heap.rooms[roomName] && global.heap.rooms[roomName].creeps) || (room.find ? room.find(FIND_MY_CREEPS) : []);
    const sources = (global.heap && global.heap.rooms && global.heap.rooms[roomName] && global.heap.rooms[roomName].sources) || (room.find ? room.find(FIND_SOURCES) : []);
    const activeSources = sources.filter(s => s.energy > 0);
    const spawns = (global.heap && global.heap.rooms && global.heap.rooms[roomName] && global.heap.rooms[roomName].spawns) || [];
    const extensions = (global.heap && global.heap.rooms && global.heap.rooms[roomName] && global.heap.rooms[roomName].extensions) || [];
    const hungryStructs = spawns.concat(extensions).filter(s => s.store && s.store.getFreeCapacity(RESOURCE_ENERGY) > 0);
    const ramparts = (global.heap && global.heap.rooms && global.heap.rooms[roomName] && global.heap.rooms[roomName].ramparts) || [];
    const criticalRampart = ramparts.find(r => r.hits < 15000);

    for (let i = 0; i < creeps.length; i++) {
        const c = creeps[i];
        if (c.spawning || c.fatigue > 0) continue;
        const carried = c.store ? (c.store[RESOURCE_ENERGY] || 0) : 0;
        const hasWork = c.getActiveBodyparts ? (c.getActiveBodyparts(WORK) > 0) : false;
        if (carried === 0) {
            if (hasWork) {
                const src = activeSources[0] || sources[0];
                if (src) {
                    if (c.pos.isNearTo(src)) c.harvest(src);
                    else c.moveTo(src, { range: 1 });
                }
            } else {
                const containers = (global.heap && global.heap.rooms && global.heap.rooms[roomName] && global.heap.rooms[roomName].containers) || [];
                const fullCont = containers.find(ct => ct.store && (ct.store[RESOURCE_ENERGY] || 0) >= 50);
                if (fullCont) {
                    if (c.pos.isNearTo(fullCont)) c.withdraw(fullCont, RESOURCE_ENERGY);
                    else c.moveTo(fullCont, { range: 1 });
                } else {
                    const drop = room.find ? (room.find(FIND_DROPPED_RESOURCES) || []).find(d => d.amount >= 25) : null;
                    if (drop) {
                        if (c.pos.isNearTo(drop)) c.pickup(drop);
                        else c.moveTo(drop, { range: 1 });
                    }
                }
            }
        } else if (hungryStructs.length > 0) {
            const tgt = hungryStructs[0];
            if (c.pos.isNearTo(tgt)) c.transfer(tgt, RESOURCE_ENERGY);
            else c.moveTo(tgt, { range: 1 });
        } else if (criticalRampart && hasWork) {
            if (c.pos.inRangeTo(criticalRampart, 3)) c.repair(criticalRampart);
            else c.moveTo(criticalRampart, { range: 3 });
        } else if (room.controller && hasWork) {
            if (c.pos.inRangeTo(room.controller, 3)) c.upgradeController(room.controller);
            else c.moveTo(room.controller, { range: 3 });
        }
    }
}

function sandbox(phaseName, fn, roomName) {
    const t0 = Game.cpu ? Game.cpu.getUsed() : 0;
    if (global.heap) global.heap.profLast = t0;
    try {
        fn();
    } catch (e) {
        if (typeof reportSubsystemError === 'function') {
            reportSubsystemError(phaseName, e, roomName);
        } else {
            log(1, `[ERROR] [${phaseName}] ${e && (e.stack || e.message || e)}`);
        }
    }
    if (Game.cpu) profileAdd(phaseName, Game.cpu.getUsed() - t0);
}

function scheduleConstructionSites(colonyName) {
    scheduleTask('planColony', { colonyName: colonyName }, 'plan:' + colonyName);
}

registerTaskHandler('planColony', (task) => {
    const room = Game.rooms ? Game.rooms[task.data.colonyName] : null;
    if (!room || !room.controller || !room.controller.my) return true;
    const rcl = room.controller.level || 1;
    if (task.step === 0) {
        placeBunkerSites(room);
        task.step = 1;
        return rcl < 3;
    }
    if (task.step === 1) {
        if (rcl >= 3) planRoadNetwork(room);
        task.step = 2;
        return rcl < 4;
    }
    if (rcl >= 4 && (!Game.cpu || Game.cpu.bucket === undefined || Game.cpu.bucket >= 2000)) {
        planMincutRamparts(room.name);
    }
    return true;
});

function placeConstructionSites(colonyNameOrRoom) {
    const room = typeof colonyNameOrRoom === 'string'
        ? (Game.rooms ? Game.rooms[colonyNameOrRoom] : null)
        : colonyNameOrRoom;
    if (!room || !room.controller || !room.controller.my) return;

    const rcl = room.controller.level || 1;

    placeBunkerSites(room);
    if (rcl >= 3) {
        planRoadNetwork(room);
    }
    if (rcl >= 4 && (!Game.cpu || Game.cpu.bucket === undefined || Game.cpu.bucket >= 2000)) {
        planMincutRamparts(room.name);
    }
}

function loop() {
    // 1. RawMemory Interceptor & Tigga Bypass (Eyes)
    sandbox('RawMemory & State', () => {
        if (!_parsedMemory || Game.time !== _lastTime + 1) {
            const raw = (typeof RawMemory !== 'undefined' && RawMemory.get) ? RawMemory.get() : null;
            _parsedMemory = raw ? JSON.parse(raw) : {};
            if (!global.heap) global.heap = {};
            global.heap.state = _parsedMemory;
            hydrateConfig(_parsedMemory);
            global.heap.memoryDirty = false;
        }

        delete global.Memory;
        global.Memory = _parsedMemory;
        if (typeof RawMemory !== 'undefined') {
            delete RawMemory._parsed;
        }
        _lastTime = Game.time;

        const curCreepCount = Game.creeps ? Object.keys(Game.creeps).length : 0;
        if (Game.time % 20 === 0 || Game.time === 1 || (global.heap._lastCreepCount !== undefined && curCreepCount < global.heap._lastCreepCount)) {
            cleanupMemory();
        }
        global.heap._lastCreepCount = curCreepCount;
        scanGlobalState();

        // Auto-heal maintenance mode: clear when room has recovered and had no errors last tick
        if (global.heap && global.heap.maintenanceMode) {
            for (const r in global.heap.maintenanceMode) {
                const rErr = global.heap.roomErrors && global.heap.roomErrors[r];
                if (!rErr || rErr.tick < Game.time - 1 || rErr.count < 5) {
                    delete global.heap.maintenanceMode[r];
                }
            }
        }

        if (Game.time === 1 || Game.time % 50 === 0) {
            const firstColName = Object.keys(global.heap.colonies || {})[0];
            const rs = firstColName && global.heap.rooms ? global.heap.rooms[firstColName] : null;
            const r = firstColName ? Game.rooms[firstColName] : null;
            if (r && rs) {
                const sp = rs.spawns || [];
                const src = rs.sources || [];
                const cr = rs.creeps || [];
                log(2, '[DEBUG] [POS] T:' + Game.time + ' Room:' + firstColName + ' ctrl:' + (rs.controller ? rs.controller.pos.x + ',' + rs.controller.pos.y + '(' + rs.controller.level + ':' + rs.controller.progress + ')' : 'none') + ' Spawns:' + sp.map(p => p.pos.x + ',' + p.pos.y) + ' | Src:' + src.map(x => x.pos.x + ',' + x.pos.y) + ' | Creeps:' + cr.length);
            }
        }
    });

    const execMode = getExecutionMode();
    const colonies = (global.heap && global.heap.colonies) || {};
    const colonyNames = Object.keys(colonies);
    if (!colonyNames.length) {
        for (const rName in Game.rooms) {
            const r = Game.rooms[rName];
            if (r && r.controller && r.controller.my) colonyNames.push(rName);
        }
    }

    if (!global.heap.lastRcl) global.heap.lastRcl = {};
    let hasRcl6Colony = false;

    // 2. Empire Macro & Outpost Partitioning (Deduplicate outposts across sister colonies)
    sandbox('Empire Outposts', () => {
        if (!global.heap || !global.heap.empireOutpostsPartitionedAt || (Game.time - global.heap.empireOutpostsPartitionedAt) >= 25) {
            partitionEmpireOutposts();
        }
    });

    // 3. Owned Colony Real-Time & Throttled Macro Loop
    for (let i = 0; i < colonyNames.length; i++) {
        const colonyName = colonyNames[i];
        const room = Game.rooms[colonyName];
        if (!room || !room.controller || !room.controller.my) continue;

        const rcl = room.controller.level || 1;
        const rclIncreased = global.heap.lastRcl[colonyName] !== undefined && rcl > global.heap.lastRcl[colonyName];
        global.heap.lastRcl[colonyName] = rcl;

        // Throttled Macro Planners (Tick 5, staggered every 50 ticks per colony, or immediately upon RCL level-up)
        const roomOffset = (colonyName.charCodeAt(0) * 7 + (colonyName.charCodeAt(colonyName.length - 1) || 0)) % 50;
        if (execMode !== 'emergency' && (Game.time === 5 || (Game.time + roomOffset) % 50 === 0 || rclIncreased)) {
            sandbox('Base Planning', () => {
                scheduleConstructionSites(colonyName);
            }, colonyName);
        }

        sandbox('Defense', () => {
            runDefense(colonyName);
            if (rcl >= 8 && execMode !== 'emergency') runPowerSpawn(colonyName);
        }, colonyName);

        sandbox('Offense', () => {
            runOffense(colonyName);
        }, colonyName);

        if (rcl >= 4 && execMode !== 'emergency') {
            sandbox('Operation Phoenix', () => {
                const rState = global.heap && global.heap.rooms ? global.heap.rooms[colonyName] : null;
                runPhoenixStateMachine(room, rState);
            }, colonyName);
        }

        sandbox('Spawning', () => {
            runSpawning(colonyName);
        }, colonyName);

        const inMaintenance = !!(global.heap && global.heap.maintenanceMode && global.heap.maintenanceMode[colonyName] > Game.time);
        if (inMaintenance) {
            sandbox('Maintenance Fallback', () => {
                runMaintenanceFallback(colonyName);
            }, colonyName);
        } else {
            sandbox('Harvesters', () => {
                runHarvesters(colonyName);
            }, colonyName);

            sandbox('Logistics', () => {
                runLinks(colonyName);
                runLogistics(colonyName);
            }, colonyName);

            sandbox('Workers', () => {
                runWorkers(colonyName);
            }, colonyName);
        }

        sandbox('Remotes', () => {
            planOutposts(colonyName);
        }, colonyName);

        const locked = !!(global.heap && global.heap.lockdown && global.heap.lockdown[colonyName] > Game.time);
        if (rcl >= 6 && execMode !== 'emergency') {
            hasRcl6Colony = true;
            sandbox('Industry & Observer', () => {
                if (!locked) runLabs(colonyName);
                runTerminal(colonyName);
                if (rcl >= 7 && !locked) runFactory(colonyName);
                runObserver(colonyName);
            }, colonyName);
        }
    }

    if (hasRcl6Colony && execMode !== 'emergency') {
        sandbox('Market', () => {
            runMarket();
        });
    }

    sandbox('Siege Target Selection', () => {
        selectSiegeTarget();
    });

    sandbox('Combat Quads', () => {
        runQuadSquad();
    });

    sandbox('Power Creeps', () => {
        runPowerCreeps();
    });

    // 3. All Visible Rooms Traffic Resolution (Home + Remote Outposts)
    sandbox('Traffic Engine', () => {
        for (const r in Game.rooms) {
            resolveAllTraffic(r);
        }
    });

    sandbox('Sliced Tasks', () => {
        const bucket = (Game.cpu && Game.cpu.bucket !== undefined) ? Game.cpu.bucket : 10000;
        const budget = Math.max(0.5, Math.min(4, (bucket - 2000) / 500));
        runTasks(budget);
    });

    // 4. Flight Recorder & Colony Health Telemetry
    sandbox('Colony Health & Telemetry', () => {
        for (let i = 0; i < colonyNames.length; i++) {
            const room = Game.rooms[colonyNames[i]];
            if (room && evaluateColonyHealth) {
                evaluateColonyHealth(room);
            }
        }
        logTickTelemetry();
        flushSegmentPager();
    });

    // 5. Tigga Serialization Bypass: only stringify & set when memory is dirty (throttled in peacetime to coalesce mutations)
    if (global.heap && global.heap.memoryDirty && (Game.time % 50 === 0 || global.heap.forceMemoryFlush)) {
        if (typeof RawMemory !== 'undefined' && RawMemory.set) {
            RawMemory.set(JSON.stringify(global.heap.state || _parsedMemory || {}));
            delete RawMemory._parsed;
        }
        global.heap.memoryDirty = false;
        global.heap.forceMemoryFlush = false;
    } else {
        if (typeof RawMemory !== 'undefined') {
            delete RawMemory._parsed;
        }
    }

    profileEndTick();
}

function logTickTelemetry() {
    if (typeof Game === 'undefined') return;

    if (!global.heap) global.heap = {};
    if (!global.heap.metrics) {
        global.heap.metrics = {
            startTick: Game.time,
            harvested: 0,
            upgraded: 0,
            lastSourceEnergy: {},
            lastControllerProgress: {}
        };
    }
    const metrics = global.heap.metrics;

    for (const roomName in Game.rooms) {
        const room = Game.rooms[roomName];
        if (!room.controller || !room.controller.my) continue;

        const roomState = (global.heap.rooms && global.heap.rooms[roomName]) || {};
        const sources = roomState.sources || (room.find && typeof FIND_SOURCES !== 'undefined' ? room.find(FIND_SOURCES) : []);
        for (let i = 0; i < sources.length; i++) {
            const s = sources[i];
            const prev = metrics.lastSourceEnergy[s.id];
            if (prev !== undefined && s.energy < prev) {
                metrics.harvested += (prev - s.energy);
            }
            metrics.lastSourceEnergy[s.id] = s.energy;
        }

        const prevProg = metrics.lastControllerProgress[roomName];
        if (prevProg !== undefined && room.controller.progress > prevProg) {
            metrics.upgraded += (room.controller.progress - prevProg);
        }
        metrics.lastControllerProgress[roomName] = room.controller.progress;
    }

    const elapsed = Math.max(1, Game.time - metrics.startTick);
    const harvestEpt = +(metrics.harvested / elapsed).toFixed(2);
    const upgradeEpt = +(metrics.upgraded / elapsed).toFixed(2);

    const isMilestone = (Game.time % 25 === 0) || (typeof global !== 'undefined' && global.verboseLogging);
    if (!isMilestone) return;

    for (const roomName in Game.rooms) {
        const room = Game.rooms[roomName];
        if (!room.controller || !room.controller.my) continue;

        const roomState = (global.heap.rooms && global.heap.rooms[roomName]) || {};
        const creeps = roomState.creeps || (room.find ? (room.find(102) || []) : []);
        const spawns = roomState.spawns || (room.find ? (room.find(112) || []) : []);
        const spawn = spawns.length > 0 ? spawns[0] : null;
        const spawning = spawn && spawn.spawning ? (spawn.spawning.name + ' (' + spawn.spawning.remainingTime + 't)') : 'none';

        const rolesCount = {};
        for (let i = 0; i < creeps.length; i++) {
            const role = (creeps[i].memory && creeps[i].memory.role) || (creeps[i].name ? creeps[i].name.split('_')[0] : 'unknown');
            rolesCount[role] = (rolesCount[role] || 0) + 1;
        }

        const cpuUsed = Game.cpu ? Game.cpu.getUsed().toFixed(2) : '0';
        const bucket = Game.cpu && Game.cpu.bucket !== undefined ? Game.cpu.bucket : 'N/A';

        log(2, '[TICK ' + Game.time + '] CPU: ' + cpuUsed + ' (B:' + bucket + ') | Room: ' + roomName + ' (RCL: ' + room.controller.level + ', ' + room.controller.progress + '/' + room.controller.progressTotal + ') | Energy: ' + room.energyAvailable + '/' + room.energyCapacityAvailable + ' | Creeps: ' + creeps.length + ' ' + JSON.stringify(rolesCount) + ' | Spawning: ' + spawning);
        log(2, '[ATC] T:' + Game.time + ' RCL:' + room.controller.level + ' (' + room.controller.progress + '/' + room.controller.progressTotal + ') | Harvest: ' + harvestEpt + ' e/t | Upgrade: ' + upgradeEpt + ' e/t | Creeps: ' + JSON.stringify(rolesCount));
        log(2, '[METRICS] ' + JSON.stringify({ harvestEpt: harvestEpt, upgradeEpt: upgradeEpt, harvested: metrics.harvested, upgraded: metrics.upgraded }));
    }
}

module.exports = {
    logTickTelemetry,
    loop,
    placeConstructionSites,
    sandbox
};
module.exports.loop = loop;
