const eventBus = require('../os/eventBus');
const RoomHasher = require('../os/roomHasher');
const RawMemoryManager = require('../os/RawMemoryManager');
const MEMORY_SEGMENTS = require('../constants/memorySegments');
const HeatmapGenerator = require('./heatmapGenerator');
const CostMatrixUpdateTrigger = require('./CostMatrixUpdateTrigger');

const CostMatrixCache = {
    get: (roomName) => {
        if (!global.State) global.State = new Map();
        if (!global.State.costMatrices) global.State.costMatrices = new Map();

        const needsUpdate = CostMatrixUpdateTrigger.shouldUpdateCostMatrix(roomName);

        if (!needsUpdate) {
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

            if (global.Cache && global.Cache.has('costMatrices')) {
                const matrices = global.Cache.get('costMatrices');
                if (matrices.has(roomName)) {
                    const serialized = matrices.get(roomName);
                    global.State.costMatrices.set(roomName, serialized);
                    return PathFinder.CostMatrix.deserialize(serialized);
                }
            }
        }

        return CostMatrixCache.generate(roomName);
    },
    set: (roomName, costMatrix) => {
        if (!global.State) global.State = new Map();
        if (!global.State.costMatrices) global.State.costMatrices = new Map();
        if (!global.State.roomHashes) global.State.roomHashes = new Map();

        const serialized = costMatrix.serialize();
        global.State.costMatrices.set(roomName, serialized);

        const hash = RoomHasher.generate(roomName);
        global.State.roomHashes.set(roomName, hash);

        if (global.Cache) {
            if (!global.Cache.has('costMatrices')) {
                global.Cache.set('costMatrices', new Map());
            }
            const matrices = global.Cache.get('costMatrices');
            matrices.set(roomName, serialized);

            if (!global.Cache.has('roomHashes')) {
                global.Cache.set('roomHashes', new Map());
            }
            global.Cache.get('roomHashes').set(roomName, hash);
        }

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
    getDynamic: (roomName, baseMatrix = null) => {
        if (!global.State) global.State = new Map();
        if (!global.State.dynamicOverlays) global.State.dynamicOverlays = new Map();
        if (!global.State.hostileHashes) global.State.hostileHashes = new Map();

        const hostiles = global.State.hostilesByRoom ? global.State.hostilesByRoom.get(roomName) : null;
        const sourceMatrix = baseMatrix || CostMatrixCache.get(roomName);

        if (!hostiles || hostiles.size === 0) {
            return sourceMatrix;
        }

        // Stronger hash logic for hostiles using primes and XOR
        let hostileHash = hostiles.size;
        for (const hostile of hostiles.values()) {
            hostileHash ^= (hostile.pos.x * 73) ^ (hostile.pos.y * 191);
        }

        const cachedHash = global.State.hostileHashes.get(roomName);
        let overlay;

        if (cachedHash === hostileHash && global.State.dynamicOverlays.has(roomName)) {
            overlay = global.State.dynamicOverlays.get(roomName);
        } else {
            overlay = HeatmapGenerator.generateOverlay(hostiles.values());
            global.State.hostileHashes.set(roomName, hostileHash);
            global.State.dynamicOverlays.set(roomName, overlay);
        }

        return HeatmapGenerator.applyOverlay(sourceMatrix, overlay);
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
