const SystemScheduler = require('../src/os/SystemScheduler');

describe('SystemScheduler', () => {
    beforeEach(() => {
        SystemScheduler.tasks.clear();
        global.Game = { time: 0 };
    });

    it('should register a task', () => {
        const callback = jest.fn();
        SystemScheduler.register('test', 10, callback);
        expect(SystemScheduler.tasks.has('test')).toBe(true);
    });

    it('should run a task when the interval matches Game.time', () => {
        const callback = jest.fn();
        SystemScheduler.register('test', 10, callback);

        global.Game.time = 10;
        SystemScheduler.run();
        expect(callback).toHaveBeenCalledTimes(1);

        global.Game.time = 20;
        SystemScheduler.run();
        expect(callback).toHaveBeenCalledTimes(2);
    });

    it('should not run a task when the interval does not match Game.time', () => {
        const callback = jest.fn();
        SystemScheduler.register('test', 10, callback);

        global.Game.time = 5;
        SystemScheduler.run();
        expect(callback).not.toHaveBeenCalled();

        global.Game.time = 15;
        SystemScheduler.run();
        expect(callback).not.toHaveBeenCalled();
    });
});
