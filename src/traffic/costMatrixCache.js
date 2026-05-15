const eventBus = require('../os/eventBus');

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
