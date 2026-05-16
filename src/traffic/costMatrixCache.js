const eventBus = require('../os/eventBus');
const RoomHasher = require('../os/roomHasher');
const HeatmapGenerator = require('./heatmapGenerator');

const CostMatrixCache = {
    get: (roomName) => {
        if (!global.State) global.State = {};
        if (!global.State.costMatrices) global.State.costMatrices = new Map();

        if (global.State.costMatrices.has(roomName)) {
            return PathFinder.CostMatrix.deserialize(global.State.costMatrices.get(roomName));
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
    },
    invalidate: (roomName) => {
        // Strictly defer cache deletion to the eventBus handler, preserving caching behavior
        eventBus.publish('INVALIDATE_COSTMATRIX', { roomName });
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
    },
    getHeatmap: (roomName) => {
        if (!global.State) global.State = {};
        if (!global.State.hostilesByRoom || !global.State.hostilesByRoom.has(roomName)) {
            return CostMatrixCache.get(roomName);
        }

        const hostiles = global.State.hostilesByRoom.get(roomName);
        if (!hostiles || hostiles.length === 0) {
            return CostMatrixCache.get(roomName);
        }

        // Generate a lightweight string hash of hostile positions
        let hashStr = `${roomName}:`;
        const sortedHostiles = hostiles.slice().sort((a, b) => a.id.localeCompare(b.id));
        for (const hostile of sortedHostiles) {
            hashStr += `${hostile.id}@${hostile.pos.x},${hostile.pos.y};`;
        }
        const hash = RoomHasher.hashString(hashStr);

        if (!global.State.heatmapHashes) global.State.heatmapHashes = new Map();
        if (!global.State.heatmaps) global.State.heatmaps = new Map();

        const currentHash = global.State.heatmapHashes.get(roomName);
        if (currentHash === hash && global.State.heatmaps.has(roomName)) {
            return PathFinder.CostMatrix.deserialize(global.State.heatmaps.get(roomName));
        }

        const baseMatrix = CostMatrixCache.get(roomName);
        const heatmap = HeatmapGenerator.generate(roomName, baseMatrix, hostiles);

        CostMatrixCache.setHeatmap(roomName, heatmap, hash);
        return heatmap;
    },
    setHeatmap: (roomName, costMatrix, hash) => {
        if (!global.State) global.State = {};
        if (!global.State.heatmapHashes) global.State.heatmapHashes = new Map();
        if (!global.State.heatmaps) global.State.heatmaps = new Map();

        const serialized = costMatrix.serialize();
        global.State.heatmaps.set(roomName, serialized);
        global.State.heatmapHashes.set(roomName, hash);
    }
};

module.exports = CostMatrixCache;
