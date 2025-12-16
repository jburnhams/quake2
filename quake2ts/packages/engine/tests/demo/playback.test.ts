import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DemoPlaybackController, PlaybackState, FrameOffset, TimeOffset } from '../../src/demo/playback';
import { DemoReader } from '../../src/demo/demoReader';

// Mock DemoReader
vi.mock('../../src/demo/demoReader', () => {
    return {
        DemoReader: vi.fn().mockImplementation(() => {
            return {
                getMessageCount: vi.fn().mockReturnValue(100),
                getProgress: vi.fn().mockReturnValue({ total: 1000, current: 0 }),
                getOffset: vi.fn().mockReturnValue(0),
                reset: vi.fn(),
                hasMore: vi.fn().mockReturnValue(true),
                readNextBlock: vi.fn().mockReturnValue({ data: new Uint8Array(0) }),
                seekToMessage: vi.fn().mockReturnValue(true)
            };
        })
    };
});

// Mock NetworkMessageParser to trigger handler
vi.mock('../../src/demo/parser', () => {
    return {
        NetworkMessageParser: vi.fn().mockImplementation((data, handler) => {
            return {
                setProtocolVersion: vi.fn(),
                getProtocolVersion: vi.fn().mockReturnValue(31),
                parseMessage: vi.fn().mockImplementation(() => {
                    // Simulate parsing a frame by calling the handler
                    if (handler && handler.onFrame) {
                        handler.onFrame({
                            sequence: 0,
                            deltaSequence: 0,
                            timestamp: 0,
                            playerState: null,
                            packetEntities: null
                        });
                    }
                })
            };
        })
    };
});

describe('DemoPlaybackController Offset Parameters', () => {
    let controller: DemoPlaybackController;
    let mockReader: any;

    beforeEach(() => {
        vi.clearAllMocks();
        controller = new DemoPlaybackController();
        controller.loadDemo(new ArrayBuffer(100));
        // Access the private reader instance through the mock
        mockReader = (DemoReader as any).mock.results[0].value;
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
        // We start at frame 10.
        // update(0.1) -> accumulated 100ms -> processNextFrame -> frame 11 -> trigger onFrame -> check >= 15 (no)
        // update(0.1) -> frame 12
        // update(0.1) -> frame 13
        // update(0.1) -> frame 14
        // update(0.1) -> frame 15 -> trigger onFrame -> check >= 15 (yes) -> pause -> onComplete

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
        expect(controller.getCurrentFrame()).toBe(99);

        controller.seekToFrame(-50);
        expect(controller.getCurrentFrame()).toBe(0);
    });
});
