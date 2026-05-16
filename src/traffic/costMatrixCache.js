const eventBus = require('../os/eventBus');

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

        const serialized = costMatrix.serialize();
        global.State.costMatrices.set(roomName, serialized);

        const matrices = global.Cache.get('costMatrices');
        matrices.set(roomName, serialized);
    },
    invalidate: (roomName) => {
        if (global.State && global.State.costMatrices) {
            global.State.costMatrices.delete(roomName);
        }
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
    }
};

module.exports = CostMatrixCache;
