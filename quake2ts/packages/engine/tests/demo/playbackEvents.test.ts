import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DemoPlaybackController } from '../../src/demo/playback.js';
import { DemoAnalyzer } from '../../src/demo/analyzer.js';
import { DemoEventType } from '../../src/demo/analysis.js';

// Mock DemoReader and DemoAnalyzer
const readerMock = vi.fn(() => ({
    reset: vi.fn(),
    hasMore: vi.fn().mockReturnValue(false),
    readNextBlock: vi.fn().mockReturnValue(null),
    getProgress: vi.fn().mockReturnValue({ total: 0, current: 0 })
}));

vi.mock('../../src/demo/demoReader.js', () => ({ DemoReader: readerMock }));
vi.mock('../../src/demo/demoReader', () => ({ DemoReader: readerMock }));

// Spy on analyze method
// Note: We don't mock the module, we spy on the class method.
// But we need to make sure the imported class is the same one used in playback.ts

describe('DemoPlaybackController', () => {
    let controller: DemoPlaybackController;

    afterEach(() => {
        vi.restoreAllMocks();
    });

    beforeEach(() => {
        vi.clearAllMocks();

        // Spy on DemoAnalyzer.prototype.analyze
        vi.spyOn(DemoAnalyzer.prototype, 'analyze').mockReturnValue({
            events: [
                {
                    type: DemoEventType.Death,
                    frame: 10,
                    time: 1.0,
                    description: 'Player died'
                },
                {
                    type: DemoEventType.Chat,
                    frame: 20,
                    time: 2.0,
                    description: 'Hello world',
                    data: { level: 3 }
                }
            ],
            summary: {
                totalKills: 0,
                totalDeaths: 1,
                damageDealt: 0,
                damageReceived: 0,
                weaponUsage: new Map()
            },
            header: null,
            configStrings: new Map(),
            serverInfo: {},
            statistics: null,
            playerStats: new Map(),
            weaponStats: new Map()
        });

        controller = new DemoPlaybackController();
    });

    it('should extract events using getEvents', () => {
        const mockBuffer = new ArrayBuffer(10);
        controller.loadDemo(mockBuffer);

        const events = controller.getEvents();

        expect(events).toHaveLength(2);
        expect(events[0].type).toBe(DemoEventType.Death);
        expect(events[0].description).toBe('Player died');

        expect(events[1].type).toBe(DemoEventType.Chat);
        expect(events[1].description).toBe('Hello world');
    });

    it('should filter events', () => {
        const mockBuffer = new ArrayBuffer(10);
        controller.loadDemo(mockBuffer);

        const chatEvents = controller.filterEvents(DemoEventType.Chat);
        expect(chatEvents).toHaveLength(1);
        expect(chatEvents[0].type).toBe(DemoEventType.Chat);
    });
});
