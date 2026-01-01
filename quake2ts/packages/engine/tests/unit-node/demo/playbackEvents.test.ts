import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DemoPlaybackController } from '@quake2ts/engine/demo/playback.js';
import { DemoAnalyzer } from '@quake2ts/engine/demo/analyzer.js';
import { DemoEventType } from '@quake2ts/engine/demo/analysis.js';

// Mock DemoReader and DemoAnalyzer
const readerMock = class {
    constructor() {
        return {
            reset: vi.fn(),
            hasMore: vi.fn().mockReturnValue(false),
            readNextBlock: vi.fn().mockReturnValue(null),
            getProgress: vi.fn().mockReturnValue({ total: 0, current: 0 })
        };
    }
};

vi.mock('@quake2ts/engine/demo/demoReader.js', () => ({ DemoReader: readerMock }));
vi.mock('@quake2ts/engine/demo/demoReader', () => ({ DemoReader: readerMock }));

// We need to mock DemoAnalyzer because DemoPlaybackController instantiates it.
// If we just spy on the prototype, we assume the real class is being used.
// But if other tests mock the module, we might get interference.
// For safety, let's mock the module here too, similar to metadata.test.ts.

let mockAnalyzer: any;
const analyzerMockClass = class {
    constructor() {
        return mockAnalyzer;
    }
};

vi.mock('@quake2ts/engine/demo/analyzer.js', () => ({ DemoAnalyzer: analyzerMockClass }));
vi.mock('@quake2ts/engine/demo/analyzer', () => ({ DemoAnalyzer: analyzerMockClass }));

describe('DemoPlaybackController', () => {
    let controller: DemoPlaybackController;

    afterEach(() => {
        vi.restoreAllMocks();
    });

    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();

        mockAnalyzer = {
            analyze: vi.fn().mockReturnValue({
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
            })
        };

        // Re-import to pick up mocks
        const { DemoPlaybackController: Controller } = await import('@quake2ts/engine/demo/playback.js');
        controller = new Controller();
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
