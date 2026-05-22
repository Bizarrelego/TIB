const eventBus = require('../src/os/eventBus');
const errorHandler = require('../src/utils/errorHandler');
const Profiler = require('../src/utils/profiler');

jest.mock('../src/utils/errorHandler');
jest.mock('../src/utils/profiler');

describe('EventBus', () => {
    beforeEach(() => {
        eventBus.clear();
        jest.clearAllMocks();
        global.PROFILER_ENABLED = false;
        global.Game = { cpu: { getUsed: jest.fn(() => 10) } };
    });

    afterEach(() => {
        delete global.PROFILER_ENABLED;
        delete global.Game;
    });

    it('should initialize successfully', () => {
        eventBus.init();
        expect(eventBus.events).toBeInstanceOf(Map);
    });

    it('should allow subscribing and publishing', () => {
        const callback = jest.fn();
        eventBus.subscribe('TEST_EVENT', callback);
        eventBus.publish('TEST_EVENT', { foo: 'bar' });

        expect(callback).toHaveBeenCalledWith({ foo: 'bar' });
        expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should return a teardown function from subscribe', () => {
        const callback = jest.fn();
        const teardown = eventBus.subscribe('TEST_EVENT', callback);

        teardown();
        eventBus.publish('TEST_EVENT', { foo: 'bar' });

        expect(callback).not.toHaveBeenCalled();
    });

    it('should unsubscribe from events correctly', () => {
        const callback = jest.fn();
        eventBus.subscribe('TEST_EVENT', callback);
        eventBus.unsubscribe('TEST_EVENT', callback);

        eventBus.publish('TEST_EVENT', { foo: 'bar' });
        expect(callback).not.toHaveBeenCalled();
    });

    it('should support subscribeOnce', () => {
        const callback = jest.fn();
        eventBus.subscribeOnce('TEST_ONCE', callback);

        eventBus.publish('TEST_ONCE', 1);
        eventBus.publish('TEST_ONCE', 2);

        expect(callback).toHaveBeenCalledWith(1);
        expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should log errors using errorHandler when callbacks throw', () => {
        const error = new Error('Test Error');
        const callback = jest.fn(() => { throw error; });

        eventBus.subscribe('TEST_ERROR', callback);
        eventBus.publish('TEST_ERROR', null);

        expect(errorHandler.logError).toHaveBeenCalledWith(error, 'EventBus:TEST_ERROR');
    });

    it('should record CPU when PROFILER_ENABLED is true', () => {
        global.PROFILER_ENABLED = true;
        const callback = jest.fn();
        eventBus.subscribe('TEST_PROFILE', callback);

        eventBus.publish('TEST_PROFILE', null);

        expect(Profiler.record).toHaveBeenCalledWith('EventBus:TEST_PROFILE', expect.any(Number));
    });

    it('should handle publishing to an event with no subscribers', () => {
        expect(() => {
            eventBus.publish('NO_SUBSCRIBERS', null);
        }).not.toThrow();
    });
});
