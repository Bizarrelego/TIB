// src/config.js — Imperial Command Settings Menu & Dynamic Configuration Engine
// Strict Flat Functional Architecture: zero OOP, O(1) property reads on global.heap.state.config

const POSTURES = ['passive', 'defensive', 'hostile'];

const DEFAULT_IMPERIAL_CONFIG = {
    posture: 'defensive',
    allowPests: true,
    allowQuads: true,
    autoSafeMode: true,
    remotesByRcl: { 1: 0, 2: 0, 3: 2, 4: 3, 5: 4, 6: 4, 7: 2, 8: 2 },
    rcl7DynamicThirdRemote: true,
    rcl7ThirdRemoteEnergyCap: 400000,
    autoExpand: true,
    maxColonies: 10,
    maxEmpireRemotes: 8,
    minColonyDistance: 4,
    maxColonyDistance: 7,
    maxBootstrappingColonies: 1,
    minSponsorRcl: 4,
    minSponsorEnergy: 100000,
    expansionCpuHeadroom: 3.0,
    siegeTier1Energy: 300000,
    siegeTier2Energy: 150000,
    siegeTier3Energy: 50000,
    rcl8UpgradeSurplus: 500000,
    rampartTargetHits: { 4: 100000, 5: 300000, 6: 1000000, 7: 3000000, 8: 15000000 },
    labReactionsEnabled: true,
    boostsEnabled: true,
    marketEnabled: true,
    creditFloor: 50000,
    minDealProfit: 1000,
    powerCreepsEnabled: true,
    cpuTarget: 15,
    cpuBucketFloor: 8000,
    visualsEnabled: false,
    logLevel: 1
};

const SCHEMA = {
    'posture': { type: 'enum', values: POSTURES, group: 'POSTURE' },
    'allowPests': { type: 'bool', group: 'POSTURE' },
    'allowQuads': { type: 'bool', group: 'POSTURE' },
    'autoSafeMode': { type: 'bool', group: 'POSTURE' },
    'remotesByRcl.1': { type: 'int', min: 0, max: 8, group: 'REMOTES' },
    'remotesByRcl.2': { type: 'int', min: 0, max: 8, group: 'REMOTES' },
    'remotesByRcl.3': { type: 'int', min: 0, max: 8, group: 'REMOTES' },
    'remotesByRcl.4': { type: 'int', min: 0, max: 8, group: 'REMOTES' },
    'remotesByRcl.5': { type: 'int', min: 0, max: 8, group: 'REMOTES' },
    'remotesByRcl.6': { type: 'int', min: 0, max: 8, group: 'REMOTES' },
    'remotesByRcl.7': { type: 'int', min: 0, max: 8, group: 'REMOTES' },
    'remotesByRcl.8': { type: 'int', min: 0, max: 8, group: 'REMOTES' },
    'rcl7DynamicThirdRemote': { type: 'bool', group: 'REMOTES' },
    'rcl7ThirdRemoteEnergyCap': { type: 'int', min: 0, max: 10000000, group: 'REMOTES' },
    'autoExpand': { type: 'bool', group: 'REMOTES' },
    'maxColonies': { type: 'int', min: 1, max: 50, group: 'REMOTES' },
    'maxEmpireRemotes': { type: 'int', min: 0, max: 32, group: 'REMOTES' },
    'minColonyDistance': { type: 'int', min: 2, max: 10, group: 'REMOTES' },
    'maxColonyDistance': { type: 'int', min: 4, max: 15, group: 'REMOTES' },
    'maxBootstrappingColonies': { type: 'int', min: 0, max: 5, group: 'REMOTES' },
    'minSponsorRcl': { type: 'int', min: 3, max: 8, group: 'REMOTES' },
    'minSponsorEnergy': { type: 'int', min: 0, max: 1000000, group: 'ECONOMY' },
    'expansionCpuHeadroom': { type: 'float', min: 0, max: 50, group: 'CPU' },
    'siegeTier1Energy': { type: 'int', min: 0, max: 10000000, group: 'ECONOMY' },
    'siegeTier2Energy': { type: 'int', min: 0, max: 10000000, group: 'ECONOMY' },
    'siegeTier3Energy': { type: 'int', min: 0, max: 10000000, group: 'ECONOMY' },
    'rcl8UpgradeSurplus': { type: 'int', min: 0, max: 10000000, group: 'ECONOMY' },
    'rampartTargetHits.4': { type: 'int', min: 1000, max: 300000000, group: 'ECONOMY' },
    'rampartTargetHits.5': { type: 'int', min: 1000, max: 300000000, group: 'ECONOMY' },
    'rampartTargetHits.6': { type: 'int', min: 1000, max: 300000000, group: 'ECONOMY' },
    'rampartTargetHits.7': { type: 'int', min: 1000, max: 300000000, group: 'ECONOMY' },
    'rampartTargetHits.8': { type: 'int', min: 1000, max: 300000000, group: 'ECONOMY' },
    'labReactionsEnabled': { type: 'bool', group: 'LABS/MARKET' },
    'boostsEnabled': { type: 'bool', group: 'LABS/MARKET' },
    'marketEnabled': { type: 'bool', group: 'LABS/MARKET' },
    'creditFloor': { type: 'int', min: 0, max: 1000000000, group: 'LABS/MARKET' },
    'minDealProfit': { type: 'int', min: 0, max: 1000000000, group: 'LABS/MARKET' },
    'powerCreepsEnabled': { type: 'bool', group: 'LABS/MARKET' },
    'cpuTarget': { type: 'int', min: 5, max: 100, group: 'CPU' },
    'cpuBucketFloor': { type: 'int', min: 0, max: 10000, group: 'CPU' },
    'visualsEnabled': { type: 'bool', group: 'CPU' },
    'logLevel': { type: 'int', min: 0, max: 2, group: 'CPU' }
};

const GROUP_ORDER = ['POSTURE', 'REMOTES', 'ECONOMY', 'LABS/MARKET', 'CPU'];

function cloneDefault(val) {
    if (val === null || typeof val !== 'object') return val;
    const out = {};
    const keys = Object.keys(val);
    for (let i = 0; i < keys.length; i++) {
        out[keys[i]] = cloneDefault(val[keys[i]]);
    }
    return out;
}

function validateValue(spec, value) {
    if (spec.type === 'enum') {
        if (typeof value !== 'string' || spec.values.indexOf(value) === -1) {
            return `expected one of [${spec.values.join(', ')}], got ${JSON.stringify(value)}`;
        }
        return null;
    }
    if (spec.type === 'bool') {
        if (typeof value !== 'boolean') {
            return `expected boolean, got ${typeof value}`;
        }
        return null;
    }
    if (spec.type === 'int') {
        if (typeof value !== 'number' || !Number.isInteger(value)) {
            return `expected integer, got ${JSON.stringify(value)}`;
        }
        if (value < spec.min || value > spec.max) {
            return `expected integer in [${spec.min}..${spec.max}], got ${value}`;
        }
        return null;
    }
    if (spec.type === 'float') {
        if (typeof value !== 'number' || !Number.isFinite(value)) {
            return `expected finite number, got ${JSON.stringify(value)}`;
        }
        if (value < spec.min || value > spec.max) {
            return `expected number in [${spec.min}..${spec.max}], got ${value}`;
        }
        return null;
    }
    return 'unknown schema type';
}

function readPath(obj, path) {
    const parts = path.split('.');
    let cur = obj;
    for (let i = 0; i < parts.length; i++) {
        if (cur === null || typeof cur !== 'object') return undefined;
        cur = cur[parts[i]];
    }
    return cur;
}

function writePath(obj, path, value) {
    const parts = path.split('.');
    let cur = obj;
    for (let i = 0; i < parts.length - 1; i++) {
        const k = parts[i];
        if (!cur[k] || typeof cur[k] !== 'object') cur[k] = {};
        cur = cur[k];
    }
    cur[parts[parts.length - 1]] = value;
}

function hydrateConfig(state) {
    if (!state || typeof state !== 'object') return cloneDefault(DEFAULT_IMPERIAL_CONFIG);
    if (!state.config || typeof state.config !== 'object' || Array.isArray(state.config)) {
        state.config = cloneDefault(DEFAULT_IMPERIAL_CONFIG);
        return state.config;
    }

    const cfg = state.config;
    const paths = Object.keys(SCHEMA);
    for (let i = 0; i < paths.length; i++) {
        const path = paths[i];
        const spec = SCHEMA[path];
        const curVal = readPath(cfg, path);
        const defVal = readPath(DEFAULT_IMPERIAL_CONFIG, path);
        if (curVal === undefined) {
            writePath(cfg, path, defVal);
        } else {
            const err = validateValue(spec, curVal);
            if (err) {
                writePath(cfg, path, defVal);
                if ((cfg.logLevel !== undefined ? cfg.logLevel : 1) >= 1) {
                    console.log(`[CONFIG] Reset invalid '${path}' (${err}) -> ${JSON.stringify(defVal)}`);
                }
            }
        }
    }
    return cfg;
}

function ensureConfigRoot() {
    if (!global.heap) global.heap = {};
    if (!global.heap.state || typeof global.heap.state !== 'object') {
        global.heap.state = (typeof Memory !== 'undefined' && Memory) ? Memory : {};
    }
    return hydrateConfig(global.heap.state);
}

function getConfig() {
    const st = (global.heap && global.heap.state) || null;
    return (st && st.config) || DEFAULT_IMPERIAL_CONFIG;
}

function setConfig(path, value) {
    const spec = SCHEMA[path];
    if (!spec) {
        return { ok: false, error: `Unknown setting '${path}'. Run imperial.settings() for valid keys.` };
    }
    const err = validateValue(spec, value);
    if (err) {
        return { ok: false, error: `Invalid value for '${path}': ${err}` };
    }
    const root = ensureConfigRoot();
    writePath(root, path, value);
    global.heap.memoryDirty = true;
    global.heap.forceMemoryFlush = true;
    return { ok: true, path, value };
}

function resetConfig(path) {
    const root = ensureConfigRoot();
    if (!path) {
        const fresh = cloneDefault(DEFAULT_IMPERIAL_CONFIG);
        if (global.heap && global.heap.state) {
            global.heap.state.config = fresh;
        }
        global.heap.memoryDirty = true;
        global.heap.forceMemoryFlush = true;
        return { ok: true, path: '*', value: fresh };
    }

    if (SCHEMA[path]) {
        const defVal = readPath(DEFAULT_IMPERIAL_CONFIG, path);
        writePath(root, path, defVal);
        global.heap.memoryDirty = true;
        global.heap.forceMemoryFlush = true;
        return { ok: true, path, value: defVal };
    }

    const subtree = readPath(DEFAULT_IMPERIAL_CONFIG, path);
    if (subtree && typeof subtree === 'object') {
        const cloned = cloneDefault(subtree);
        writePath(root, path, cloned);
        global.heap.memoryDirty = true;
        global.heap.forceMemoryFlush = true;
        return { ok: true, path, value: cloned };
    }

    return { ok: false, error: `Unknown setting or subtree '${path}'. Run imperial.settings() for valid keys.` };
}

function formatSettings() {
    const cfg = getConfig();
    const lines = ["<span style='color:#ffd700;font-weight:bold'>=== IMPERIAL SETTINGS ===</span>"];
    const paths = Object.keys(SCHEMA);

    for (let g = 0; g < GROUP_ORDER.length; g++) {
        const group = GROUP_ORDER[g];
        lines.push(`<span style='color:#66ccff;font-weight:bold'>[${group}]</span>`);
        for (let i = 0; i < paths.length; i++) {
            const path = paths[i];
            if (SCHEMA[path].group !== group) continue;
            const cur = readPath(cfg, path);
            const def = readPath(DEFAULT_IMPERIAL_CONFIG, path);
            const changed = cur !== def;
            const valStr = changed
                ? `<span style='color:#ffaa00;font-weight:bold'>${JSON.stringify(cur)}</span> <span style='color:#888888'>(default: ${JSON.stringify(def)})</span>`
                : `<span style='color:#aaffaa'>${JSON.stringify(cur)}</span>`;
            lines.push(`  ${path}: ${valStr}`);
        }
    }
    return lines.join('\n');
}

function getRampartBaseline(rcl, cfg) {
    const c = cfg || getConfig();
    const tbl = (c && c.rampartTargetHits) || DEFAULT_IMPERIAL_CONFIG.rampartTargetHits;
    if (rcl >= 8) return tbl[8] || DEFAULT_IMPERIAL_CONFIG.rampartTargetHits[8];
    if (rcl >= 7) return tbl[7] || DEFAULT_IMPERIAL_CONFIG.rampartTargetHits[7];
    if (rcl >= 6) return tbl[6] || DEFAULT_IMPERIAL_CONFIG.rampartTargetHits[6];
    if (rcl >= 5) return tbl[5] || DEFAULT_IMPERIAL_CONFIG.rampartTargetHits[5];
    if (rcl >= 4) return tbl[4] || DEFAULT_IMPERIAL_CONFIG.rampartTargetHits[4];
    return 15000;
}

function getSiegeTier(storageEnergy, cfg) {
    const c = cfg || getConfig();
    const t3 = c.siegeTier3Energy !== undefined ? c.siegeTier3Energy : DEFAULT_IMPERIAL_CONFIG.siegeTier3Energy;
    const t2 = c.siegeTier2Energy !== undefined ? c.siegeTier2Energy : DEFAULT_IMPERIAL_CONFIG.siegeTier2Energy;
    const t1 = c.siegeTier1Energy !== undefined ? c.siegeTier1Energy : DEFAULT_IMPERIAL_CONFIG.siegeTier1Energy;
    if (storageEnergy < t3) return 3;
    if (storageEnergy < t2) return 2;
    if (storageEnergy < t1) return 1.5;
    return 1;
}

function isOffenseAllowed(kind, cfg) {
    const c = cfg || getConfig();
    const posture = (c && c.posture) || 'defensive';

    if (kind === 'outpostDefender') {
        return posture !== 'passive';
    }
    if (kind === 'hunter') {
        return posture === 'defensive' || posture === 'hostile';
    }
    if (kind === 'quad') {
        return posture === 'hostile' && !!(c ? c.allowQuads : true);
    }
    if (kind === 'pest') {
        return posture === 'hostile' && !!(c ? c.allowPests : true);
    }
    if (kind === 'raider' || kind === 'assassin' || kind === 'drainer' || kind === 'wrecker') {
        return posture === 'hostile';
    }
    return posture === 'hostile';
}

function log(level, msg) {
    const cfg = getConfig();
    const lvl = (cfg && cfg.logLevel !== undefined) ? cfg.logLevel : 1;
    if (lvl >= level) console.log(msg);
}

module.exports = {
    POSTURES,
    DEFAULT_IMPERIAL_CONFIG,
    SCHEMA,
    getConfig,
    setConfig,
    resetConfig,
    hydrateConfig,
    formatSettings,
    getRampartBaseline,
    getSiegeTier,
    isOffenseAllowed,
    log
};
