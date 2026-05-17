const eventBus = require('../os/eventBus');
const RoomHasher = require('../os/roomHasher');
const RawMemoryManager = require('../os/RawMemoryManager');
const MEMORY_SEGMENTS = require('../constants/memorySegments');

const CostMatrixCache = {
    get: (roomName) => {
        if (!global.State) global.State = {};
        if (!global.State.costMatrices) global.State.costMatrices = new Map();

        if (global.State.costMatrices.has(roomName)) {
            return PathFinder.CostMatrix.deserialize(global.State.costMatrices.get(roomName));
        }

        // Attempt to deserialize from RawMemory to mitigate global reset CPU spikes
        const rawData = RawMemoryManager.getSegment(MEMORY_SEGMENTS.COST_MATRICES);
        if (rawData) {
            try {
                const parsed = JSON.parse(rawData);
                if (parsed[roomName]) {
                    global.State.costMatrices.set(roomName, parsed[roomName]);
                    return PathFinder.CostMatrix.deserialize(parsed[roomName]);
                }
            } catch (e) {
                console.log(`[CostMatrixCache] Failed to parse raw memory: ${e.message}`);
            }
        }

        const matrices = global.Cache.get('costMatrices');
        if (matrices.has(roomName)) {
            const serialized = matrices.get(roomName);
            global.State.costMatrices.set(roomName, serialized);
            return PathFinder.CostMatrix.deserialize(serialized);
        }
        return CostMatrixCache.generate(roomName);
    },
    set: (roomName, costMatrix) => {
        if (!global.State) global.State = {};
        if (!global.State.costMatrices) global.State.costMatrices = new Map();
        if (!global.State.roomHashes) global.State.roomHashes = new Map();

        const serialized = costMatrix.serialize();
        global.State.costMatrices.set(roomName, serialized);

        const hash = RoomHasher.generate(roomName);
        global.State.roomHashes.set(roomName, hash);

        const matrices = global.Cache.get('costMatrices');
        matrices.set(roomName, serialized);

        if (!global.Cache.has('roomHashes')) {
            global.Cache.set('roomHashes', new Map());
        }
        global.Cache.get('roomHashes').set(roomName, hash);

        // Serialize generated base matrix to RawMemory
        const rawData = RawMemoryManager.getSegment(MEMORY_SEGMENTS.COST_MATRICES);
        let parsed = {};
        if (rawData) {
            try {
                parsed = JSON.parse(rawData);
            } catch (e) {
                // Ignore parse errors, will overwrite with new empty object
            }
        }
        parsed[roomName] = serialized;
        RawMemoryManager.setSegment(MEMORY_SEGMENTS.COST_MATRICES, JSON.stringify(parsed));
    },
    invalidate: (roomName) => {
        // Strictly defer cache deletion to the eventBus handler, preserving caching behavior
        eventBus.publish('INVALIDATE_COSTMATRIX', { roomName });
    },
    setDynamic: (roomName, costMatrix) => {
        if (!global.State) global.State = {};
        if (!global.State.dynamicCostMatrices) global.State.dynamicCostMatrices = new Map();

        global.State.dynamicCostMatrices.set(roomName, costMatrix);
    },
    getDynamic: (roomName) => {
        if (global.State && global.State.dynamicCostMatrices && global.State.dynamicCostMatrices.has(roomName)) {
            return global.State.dynamicCostMatrices.get(roomName);
        }
        return CostMatrixCache.get(roomName);
    },
    deleteDynamic: (roomName) => {
        if (global.State && global.State.dynamicCostMatrices) {
            global.State.dynamicCostMatrices.delete(roomName);
        }
    },
    generate: (roomName) => {
        const costMatrix = new PathFinder.CostMatrix();

        if (global.State && global.State.structuresByRoom && global.State.structuresByRoom.has(roomName)) {
            const structuresMap = global.State.structuresByRoom.get(roomName);
            for (const [structureType, structures] of structuresMap.entries()) {
                if (structureType === STRUCTURE_ROAD) {
                    for (const structure of structures.values()) {
                        costMatrix.set(structure.pos.x, structure.pos.y, 1);
                    }
                } else if (structureType !== STRUCTURE_CONTAINER && structureType !== STRUCTURE_RAMPART) {
                    for (const structure of structures.values()) {
                        costMatrix.set(structure.pos.x, structure.pos.y, 255);
                    }
                }
            }
        }

        CostMatrixCache.set(roomName, costMatrix);
        return costMatrix;
    }
};

module.exports = CostMatrixCache;
