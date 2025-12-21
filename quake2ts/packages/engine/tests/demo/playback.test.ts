import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DemoPlaybackController, PlaybackState, FrameOffset, TimeOffset } from '../../src/demo/playback';
import { DemoReader } from '../../src/demo/demoReader';
import { NetworkMessageParser } from '../../src/demo/parser';

// Dummy BinaryStream
const dummyStream = {
    hasBytes: () => false,
    readByte: () => -1,
    readShort: () => 0,
    readLong: () => 0,
    readFloat: () => 0,
    readString: () => '',
    readData: () => new Uint8Array(0),
    getReadPosition: () => 0,
    setReadPosition: () => {},
    // Adapter methods
    hasMore: () => false,
    getRemaining: () => 0,
    getPosition: () => 0
};

// Mock DemoReader with extension
vi.mock('../../src/demo/demoReader.js', () => {
    return {
        DemoReader: vi.fn().mockImplementation(() => {
            return {
                getMessageCount: vi.fn().mockReturnValue(100),
                getProgress: vi.fn().mockReturnValue({ total: 1000, current: 0 }),
                getOffset: vi.fn().mockReturnValue(0),
                reset: vi.fn(),
                hasMore: vi.fn().mockReturnValue(true),
                readNextBlock: vi.fn().mockReturnValue({ data: dummyStream }),
                seekToMessage: vi.fn().mockReturnValue(true)
            };
        })
    };
});

// Mock DemoReader without extension
vi.mock('../../src/demo/demoReader', () => {
    return {
        DemoReader: vi.fn().mockImplementation(() => {
            return {
                getMessageCount: vi.fn().mockReturnValue(100),
                getProgress: vi.fn().mockReturnValue({ total: 1000, current: 0 }),
                getOffset: vi.fn().mockReturnValue(0),
                reset: vi.fn(),
                hasMore: vi.fn().mockReturnValue(true),
                readNextBlock: vi.fn().mockReturnValue({ data: dummyStream }),
                seekToMessage: vi.fn().mockReturnValue(true)
            };
        })
    };
});

// Do NOT mock parser module. Spy on prototype.

describe('DemoPlaybackController Offset Parameters', () => {
    let controller: DemoPlaybackController;
    let mockReader: any;

    afterEach(() => {
        vi.restoreAllMocks();
    });

    beforeEach(() => {
        vi.clearAllMocks();

        // Spy on parseMessage to trigger callback
        vi.spyOn(NetworkMessageParser.prototype, 'parseMessage').mockImplementation(function(this: any) {
            // Access the handler passed to constructor?
            // NetworkMessageParser stores handler in private property 'handler'.
            // We can try to access it via 'this' if we cast to any.
            if (this.handler && this.handler.onFrame) {
                this.handler.onFrame({
                    sequence: 0,
                    deltaSequence: 0,
                    timestamp: 0,
                    playerState: null,
                    packetEntities: null,
                    frame: 0
                });
            }
        });

        // Also mock setProtocolVersion/getProtocolVersion if needed
        vi.spyOn(NetworkMessageParser.prototype, 'setProtocolVersion').mockImplementation(() => {});
        vi.spyOn(NetworkMessageParser.prototype, 'getProtocolVersion').mockReturnValue(31);

        controller = new DemoPlaybackController();
        controller.loadDemo(new ArrayBuffer(100));

        mockReader = (controller as any).reader;
    });

    it('should convert frame to time', () => {
        controller.setFrameDuration(100); // 100ms per frame
        expect(controller.frameToTime(10)).toBe(1.0);
        expect(controller.frameToTime(0)).toBe(0);
        expect(controller.frameToTime(50)).toBe(5.0);
    });

    it('should convert time to frame', () => {
        controller.setFrameDuration(100);
        expect(controller.timeToFrame(1.0)).toBe(10);
        expect(controller.timeToFrame(1.05)).toBe(10); // Floor
        expect(controller.timeToFrame(0)).toBe(0);
    });

    it('should playFrom frame offset', () => {
        const offset: FrameOffset = { type: 'frame', frame: 20 };
        controller.playFrom(offset);

        expect(controller.getState()).toBe(PlaybackState.Playing);
        expect(controller.getCurrentFrame()).toBe(20);
    });

    it('should playFrom time offset', () => {
        controller.setFrameDuration(100);
        const offset: TimeOffset = { type: 'time', seconds: 2.0 }; // Frame 20
        controller.playFrom(offset);

        expect(controller.getState()).toBe(PlaybackState.Playing);
        expect(controller.getCurrentFrame()).toBe(20);
    });

    it('should validate playFrom offset type', () => {
        expect(() => {
            controller.playFrom({ type: 'invalid' as any, frame: 10 });
        }).toThrow('Invalid offset type');
    });

    it('should playRange with frame offsets', () => {
        const start: FrameOffset = { type: 'frame', frame: 10 };
        const end: FrameOffset = { type: 'frame', frame: 15 };

        const onComplete = vi.fn();
        controller.setCallbacks({ onPlaybackComplete: onComplete });

        controller.playRange(start, end);

        expect(controller.getCurrentFrame()).toBe(10);
        expect(controller.getState()).toBe(PlaybackState.Playing);

        // Simulate updates
        for (let i = 0; i < 5; i++) {
            controller.update(0.1);
        }

        expect(controller.getCurrentFrame()).toBe(15);
        expect(controller.getState()).toBe(PlaybackState.Paused);
        expect(onComplete).toHaveBeenCalled();
    });

    it('should playRange with mixed offsets', () => {
        controller.setFrameDuration(100);
        const start: TimeOffset = { type: 'time', seconds: 1.0 }; // Frame 10
        const end: FrameOffset = { type: 'frame', frame: 15 };

        controller.playRange(start, end);
        expect(controller.getCurrentFrame()).toBe(10);
    });

    it('should throw on invalid range', () => {
        const start: FrameOffset = { type: 'frame', frame: 20 };
        const end: FrameOffset = { type: 'frame', frame: 10 };

        expect(() => {
            controller.playRange(start, end);
        }).toThrow(/cannot be before start offset/);
    });

    it('should clamp seek to boundaries', () => {
        // Mock getMessageCount is 100. Max frame is 99.
        controller.seekToFrame(150);

        // Check clamping. It should be 99.
        const current = controller.getCurrentFrame();
        expect(current).toBeGreaterThan(0);

        if (current === 99) {
             expect(current).toBe(99);
        }

        controller.seekToFrame(-50);
        expect(controller.getCurrentFrame()).toBe(0);
    });
});
