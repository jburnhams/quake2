import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DemoPlaybackController, PlaybackState } from '../../src/demo/playback';
import { DemoReader } from '../../src/demo/demoReader';

// Mock DemoReader
vi.mock('../../src/demo/demoReader', () => {
  return {
    DemoReader: vi.fn().mockImplementation(() => ({
      reset: vi.fn(),
      hasMore: vi.fn().mockReturnValue(true),
      readNextBlock: vi.fn().mockReturnValue({ length: 10, data: new Uint8Array(10) }),
      seekToMessage: vi.fn().mockReturnValue(true),
      getMessageCount: vi.fn().mockReturnValue(100),
      getOffset: vi.fn().mockReturnValue(0),
      getProgress: vi.fn().mockReturnValue({ total: 1000, current: 0, percent: 0 }),
    }))
  };
});

// Mock NetworkMessageParser to avoid parsing errors
vi.mock('../../src/demo/parser', () => {
    return {
        NetworkMessageParser: vi.fn().mockImplementation((buffer, handler) => ({
            setProtocolVersion: vi.fn(),
            getProtocolVersion: vi.fn().mockReturnValue(34),
            parseMessage: vi.fn().mockImplementation(() => {
                if (handler && handler.onFrame) {
                    handler.onFrame({
                        playerState: {},
                        packetEntities: [],
                        frame: 0
                    });
                }
            })
        })),
        createEmptyEntityState: vi.fn(),
        createEmptyProtocolPlayerState: vi.fn()
    }
});

describe('DemoPlaybackController Offset Parameters', () => {
  let controller: DemoPlaybackController;
  let mockReader: any;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new DemoPlaybackController();
    // Must set a handler for onFrame callbacks to propagate through the parser
    controller.setHandler({} as any);
    const buffer = new ArrayBuffer(100);
    controller.loadDemo(buffer);
    // Access the private reader if needed via casting or assume methods work because of mock
  });

  it('should convert frame to time correctly', () => {
    controller.setFrameDuration(100); // 100ms per frame
    expect(controller.frameToTime(0)).toBe(0);
    expect(controller.frameToTime(10)).toBe(1.0);
    expect(controller.frameToTime(25)).toBe(2.5);
  });

  it('should convert time to frame correctly', () => {
    controller.setFrameDuration(100); // 100ms per frame
    expect(controller.timeToFrame(0)).toBe(0);
    expect(controller.timeToFrame(1.0)).toBe(10);
    expect(controller.timeToFrame(2.55)).toBe(25); // Math.floor
  });

  it('should playFrom with frame offset', () => {
    const playSpy = vi.spyOn(controller, 'play');
    const seekSpy = vi.spyOn(controller, 'seek');

    controller.playFrom({ type: 'frame', frame: 50 });

    expect(seekSpy).toHaveBeenCalledWith(50);
    expect(playSpy).toHaveBeenCalled();
  });

  it('should playFrom with time offset', () => {
    controller.setFrameDuration(100);
    const playSpy = vi.spyOn(controller, 'play');
    const seekSpy = vi.spyOn(controller, 'seek');

    controller.playFrom({ type: 'time', seconds: 5.0 });

    expect(seekSpy).toHaveBeenCalledWith(50); // 5.0s / 0.1s = 50 frames
    expect(playSpy).toHaveBeenCalled();
  });

  it('should playRange and stop at end frame', () => {
    const start = { type: 'frame' as const, frame: 10 };
    const end = { type: 'frame' as const, frame: 12 };

    const pauseSpy = vi.spyOn(controller, 'pause');
    const onFrameUpdate = vi.fn();

    controller.setCallbacks({ onFrameUpdate });
    controller.playRange(start, end);

    // playRange calls playFrom -> seek(10). Seek processes frames 0-10.
    // So onFrameUpdate is called 11 times (frames 0, 1, ..., 10) during setup.
    // We want to verify behavior for frames 11 and 12.
    const initialCalls = onFrameUpdate.mock.calls.length;

    expect(controller.getState()).toBe(PlaybackState.Playing);

    // Frame 11
    controller.update(0.1); // Advance 100ms (1 frame)
    expect(controller.getCurrentFrame()).toBe(11);
    expect(onFrameUpdate).toHaveBeenCalledTimes(initialCalls + 1);
    expect(controller.getState()).toBe(PlaybackState.Playing);

    // Frame 12
    controller.update(0.1);
    expect(controller.getCurrentFrame()).toBe(12);
    expect(onFrameUpdate).toHaveBeenCalledTimes(initialCalls + 2);

    // Should pause AFTER this frame is processed
    expect(controller.getState()).toBe(PlaybackState.Paused);
    expect(pauseSpy).toHaveBeenCalled();
  });

  it('should handle mixed offset types in playRange', () => {
    controller.setFrameDuration(100);
    const seekSpy = vi.spyOn(controller, 'seek');

    controller.playRange(
        { type: 'time', seconds: 1.0 }, // Frame 10
        { type: 'frame', frame: 15 }
    );

    expect(seekSpy).toHaveBeenCalledWith(10);
    // End frame logic is internal to callback wrapper, verified in previous test
  });

  it('should handle validation (negative values)', () => {
    const seekSpy = vi.spyOn(controller, 'seek');

    // seek method handles negative clamping internally
    controller.playFrom({ type: 'frame', frame: -5 });
    expect(seekSpy).toHaveBeenCalledWith(-5);
    // Logic inside seek will clamp it to 0.
  });
});
