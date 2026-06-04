
class Upgrader {
    static assignTask(creep, roomState) {
        if (roomState.controller) {
            creep.heap.targetId = roomState.controller.id;
            creep.heap.actionIntent = 'upgrade';

            if (!creep.heap.sitTargetId && roomState.controllerContainers) {
                if (roomState.controllerContainers.length > 0) {
                    creep.heap.sitTargetId = roomState.controllerContainers[0].id;
                }
            }
        }
    }
}

module.exports = Upgrader;