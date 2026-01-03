import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { DemoPlaybackController, PlaybackState } from '../../src/demo/playback.js';
import { DemoReader } from '../../src/demo/demoReader.js';
import { NetworkMessageParser } from '../../src/demo/parser.js';

describe('DemoPlaybackController with Tracking', () => {
    let controller: DemoPlaybackController;
    let tracker: any;

    beforeEach(() => {
        vi.restoreAllMocks();

        // Spy on DemoReader
        vi.spyOn(DemoReader.prototype, 'getMessageCount').mockReturnValue(100);
        vi.spyOn(DemoReader.prototype, 'seekToMessage').mockReturnValue(true);
        vi.spyOn(DemoReader.prototype, 'reset').mockImplementation(() => {});
        vi.spyOn(DemoReader.prototype, 'hasMore').mockReturnValue(true);

        // Mock readNextBlock
        const readNextBlockSpy = vi.spyOn(DemoReader.prototype, 'readNextBlock');
        for(let i=0; i<50; i++) {
            readNextBlockSpy.mockReturnValueOnce({
                length: 10,
                data: {} as any
            });
        }
        readNextBlockSpy.mockReturnValue(null);

        // Mock NetworkMessageParser
        vi.spyOn(NetworkMessageParser.prototype, 'parseMessage').mockImplementation(() => {});
        vi.spyOn(NetworkMessageParser.prototype, 'setProtocolVersion').mockImplementation(() => {});

        controller = new DemoPlaybackController();
        controller.loadDemo(new ArrayBuffer(100));

        tracker = {
            startTracking: vi.fn(),
            stopTracking: vi.fn(),
            updateFrame: vi.fn(),
            updateTime: vi.fn(),
            reset: vi.fn(),
            setCurrentFrame: vi.fn(),
            setCurrentTime: vi.fn()
        };
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should handle playRangeWithTracking', async () => {
        const startSpy = vi.spyOn(tracker, 'startTracking');
        const stopSpy = vi.spyOn(tracker, 'stopTracking');

        // Start playback (non-fastForward)
        const promise = controller.playRangeWithTracking(
            { frame: 0, type: 'frame' } as any,
            { frame: 5, type: 'frame' } as any,
            tracker,
            { fastForward: false }
        );

        expect(tracker.startTracking).toHaveBeenCalled();

        // Manual update loop
        // We need to pump enough updates to reach frame 5
        let i = 0;
        // Limit iterations to prevent infinite loop, but make sure it's enough
        while(i < 50) {
            controller.update(0.1);
            if (controller.getState() !== PlaybackState.Playing) break;
            i++;
        }

        await promise;

        expect(tracker.stopTracking).toHaveBeenCalled();
    });

    it('should handle fastForward mode', async () => {
        const result = await controller.playRangeWithTracking(
            { frame: 0, type: 'frame' } as any,
            { frame: 5, type: 'frame' } as any,
            tracker,
            { fastForward: true }
        );

        expect(tracker.startTracking).toHaveBeenCalled();
        expect(tracker.stopTracking).toHaveBeenCalled();
        expect(controller.getState()).not.toBe(PlaybackState.Playing);
    });

    it('should update tracker frame/time during playback', async () => {
        const promise = controller.playRangeWithTracking(
            { frame: 0, type: 'frame' } as any,
            { frame: 5, type: 'frame' } as any,
            tracker,
            { fastForward: false }
        );

        controller.update(0.1);

        expect(tracker.setCurrentFrame).toHaveBeenCalled();
        expect(tracker.setCurrentTime).toHaveBeenCalled();

        // Finish
        let i = 0;
        while(i < 50) {
            controller.update(0.1);
            if (controller.getState() !== PlaybackState.Playing) break;
            i++;
        }
        await promise;
    });
});
