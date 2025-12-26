import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { DemoPlaybackController } from '../../src/demo/playback.js';
import { DemoReader } from '../../src/demo/demoReader.js';
import { NetworkMessageParser } from '../../src/demo/parser.js';

describe('DemoPlaybackController Metadata & Seek', () => {
    let controller: DemoPlaybackController;

    beforeEach(() => {
        vi.restoreAllMocks();

        // Spy on DemoReader prototype methods
        vi.spyOn(DemoReader.prototype, 'getMessageCount').mockReturnValue(100);
        vi.spyOn(DemoReader.prototype, 'seekToMessage').mockReturnValue(true);
        vi.spyOn(DemoReader.prototype, 'reset').mockImplementation(() => {});
        vi.spyOn(DemoReader.prototype, 'hasMore').mockReturnValue(true);

        // Mock readNextBlock
        const readNextBlockSpy = vi.spyOn(DemoReader.prototype, 'readNextBlock');
        for(let i=0; i<100; i++) {
             readNextBlockSpy.mockReturnValueOnce({
                length: 10,
                data: {} as any
            });
        }
        readNextBlockSpy.mockReturnValue(null);

        vi.spyOn(NetworkMessageParser.prototype, 'parseMessage').mockImplementation(() => {});
        vi.spyOn(NetworkMessageParser.prototype, 'setProtocolVersion').mockImplementation(() => {});

        controller = new DemoPlaybackController();
        controller.loadDemo(new ArrayBuffer(100));
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should report correct total frames', () => {
        expect(controller.getTotalFrames()).toBe(100);
    });

    it('should report correct duration (default 10Hz)', () => {
        expect(controller.getDuration()).toBe(10);
    });

    it('should update current frame during playback', () => {
        controller.play(); // state -> Playing

        controller.stepForward();
        // Index -1 -> 0
        expect(controller.getCurrentFrame()).toBe(0);

        controller.stepForward();
        // Index 0 -> 1
        expect(controller.getCurrentFrame()).toBe(1);
    });

    it('should seek to specific frame', () => {
        const targetFrame = 50;
        controller.seek(targetFrame);

        expect(controller.getCurrentFrame()).toBe(targetFrame);
    });

    it('should clamp seek to bounds', () => {
        controller.seek(200);
        expect(controller.getCurrentFrame()).toBeGreaterThan(0);
        // Logic might clamp to max, which is determined by hasMore / readNextBlock returning null.
        // If readNextBlock returns 100 frames, it should stop around 99 or 100.
        // It relies on processNextFrame loop.
        expect(controller.getCurrentFrame()).toBe(99);
    });

    it('should reset accumulators on seek', () => {
        controller.update(0.05); // Add 0.05s

        controller.seek(10);

        // Frame 10 is at 1.0s exactly.
        // Seek should reset accumulatedTime to 0.
        expect(controller.getCurrentTime()).toBe(1.0);
    });
});
