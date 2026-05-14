// Tigga-Style Optimized Cache Initialization
const eventBus = require('./eventBus');

const CacheRegistry = {
    // Utilize direct reference assignment for O(1) performance
    init: () => {
        global.Cache = new Map([
            ['structures', new Map()],
            ['creeps', new Map()],
            ['sources', new Map()],
            ['costMatrices', new Map()]
        ]);

        // Event-Driven Hydration: Only trigger on StateScanner update events
        eventBus.subscribe('INVALIDATE_COSTMATRIX', (data) => {
            const roomName = typeof data === 'string' ? data : data.roomName;
            if (global.Cache && global.Cache.has('costMatrices')) {
                const matrices = global.Cache.get('costMatrices');
                matrices.delete(roomName);
                CostMatrixCache.generate(roomName);
            }
        });
    },
    // Event-Driven Hydration: Only trigger on StateScanner update events
    hydrate: (key, dataMap) => {
        if (!global.Cache.has(key) || !(dataMap instanceof Map)) return;
        const target = global.Cache.get(key);
        // Clear and update only the delta to minimize CPU
        target.clear();
        for (const [k, v] of dataMap) {
            target.set(k, v);
        }
    }
};

const CostMatrixCache = {
    get: (roomName) => {
        const matrices = global.Cache.get('costMatrices');
        if (matrices.has(roomName)) {
            const serialized = matrices.get(roomName);
            return PathFinder.CostMatrix.deserialize(serialized);
        }
        return CostMatrixCache.generate(roomName);
    },
    set: (roomName, costMatrix) => {
        const matrices = global.Cache.get('costMatrices');
        matrices.set(roomName, costMatrix.serialize());
    },
    invalidate: (roomName) => {
        eventBus.publish('INVALIDATE_COSTMATRIX', { roomName });
    },
    generate: (roomName) => {
        const costMatrix = new PathFinder.CostMatrix();

        if (global.State && global.State.structuresByRoom && global.State.structuresByRoom.has(roomName)) {
            const structuresMap = global.State.structuresByRoom.get(roomName);
            for (const [structureType, structures] of structuresMap.entries()) {
                if (structureType === STRUCTURE_ROAD) {
                    for (const structure of structures) {
                        costMatrix.set(structure.pos.x, structure.pos.y, 1);
                    }
                } else if (structureType !== STRUCTURE_CONTAINER && structureType !== STRUCTURE_RAMPART) {
                    for (const structure of structures) {
                        costMatrix.set(structure.pos.x, structure.pos.y, 255);
                    }
                }
            }
        }

        CostMatrixCache.set(roomName, costMatrix);
        return costMatrix;
    }
};

module.exports = { CacheRegistry, CostMatrixCache };
