import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { DemoPlaybackController } from '../../../src/demo/playback.js';
import { DemoReader } from '../../../src/demo/demoReader.js';
import { NetworkMessageParser } from '../../../src/demo/parser.js';

describe('DemoPlaybackController Offset Parameters', () => {
    let controller: DemoPlaybackController;

    beforeEach(() => {
        vi.restoreAllMocks();

        // Spy on DemoReader prototype methods
        vi.spyOn(DemoReader.prototype, 'getMessageCount').mockReturnValue(100);
        vi.spyOn(DemoReader.prototype, 'seekToMessage').mockReturnValue(true);
        vi.spyOn(DemoReader.prototype, 'reset').mockImplementation(() => {});
        vi.spyOn(DemoReader.prototype, 'hasMore').mockReturnValue(true);

        // IMPORTANT: processNextFrame uses readNextBlock, NOT nextBlock.
        vi.spyOn(DemoReader.prototype, 'readNextBlock').mockReturnValue({
            length: 10,
            data: {
                readUint8: vi.fn().mockReturnValue(0),
                readFloat32: vi.fn().mockReturnValue(0),
                readInt32: vi.fn().mockReturnValue(0),
                readInt16: vi.fn().mockReturnValue(0),
                readString: vi.fn().mockReturnValue(''),
                hasMoreData: vi.fn().mockReturnValue(false),
                seek: vi.fn(),
                skip: vi.fn(),
                readBytes: vi.fn().mockReturnValue(new Uint8Array(0))
            } as any
        });

        // Mock NetworkMessageParser
        vi.spyOn(NetworkMessageParser.prototype, 'parseMessage').mockImplementation(() => {});
        vi.spyOn(NetworkMessageParser.prototype, 'setProtocolVersion').mockImplementation(() => {});
        vi.spyOn(NetworkMessageParser.prototype, 'getProtocolVersion').mockReturnValue(34);

        controller = new DemoPlaybackController();
        controller.loadDemo(new ArrayBuffer(100));
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should playFrom frame offset', () => {
        const reader = (controller as any).reader;
        const startFrame = 50;
        controller.playFrom({
            frame: startFrame,
            type: 'frame'
        });

        // Since we don't have an index, it resets and fast-forwards
        expect(reader.reset).toHaveBeenCalled();
        expect(controller.getCurrentFrame()).toBe(startFrame);
        expect(controller.getState()).toBe(1); // Playing
    });

    it('should playFrom time offset', () => {
        const startTime = 5.0; // seconds

        controller.playFrom({
            seconds: startTime,
            type: 'time'
        });

        // getCurrentTime returns Seconds (not MS)
        expect(controller.getCurrentTime()).toBeCloseTo(startTime, 1);
        expect(controller.getState()).toBe(1);
    });

    it('should playRange with frame offsets', () => {
        const reader = (controller as any).reader;
        const start = 10;
        const end = 20;

        controller.playRange({
            frame: start,
            type: 'frame'
        }, {
            frame: end,
            type: 'frame'
        });

        expect(reader.reset).toHaveBeenCalled();
        expect(controller.getCurrentFrame()).toBe(start);
    });

    it('should playRange with mixed offsets', () => {
        const start = 10; // frame
        const endTime = 2.0; // seconds

        controller.playRange({
            frame: start,
            type: 'frame'
        }, {
            seconds: endTime,
            type: 'time'
        });

        expect(controller.getCurrentFrame()).toBe(start);
    });

    it('should throw on invalid range', () => {
        const start = 50;
        const end = 10;

        expect(() => {
            controller.playRange({
                frame: start,
                type: 'frame'
            }, {
                frame: end,
                type: 'frame'
            });
        }).toThrow(/cannot be before start offset/);
    });

    it('should clamp seek to boundaries', () => {
        const reader = (controller as any).reader;
        const start = 200; // > 100 messages

        // To test clamping, we need readNextBlock to return NULL eventually.
        let callCount = 0;
        vi.spyOn(DemoReader.prototype, 'readNextBlock').mockImplementation(() => {
            if (callCount++ > 100) return null;
            return { length: 0, data: {} as any };
        });

        controller.playFrom({
            frame: start,
            type: 'frame'
        });

        expect(reader.reset).toHaveBeenCalled();
        expect(controller.getCurrentFrame()).toBeLessThan(start);
    });
});
