import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DemoPlaybackController, PlaybackState } from '../../src/demo/playback';
import { ResourceLoadTracker } from '../../src/assets/resourceTracker';

// Mock DemoReader
vi.mock('../../src/demo/demoReader', () => {
  return {
    DemoReader: vi.fn().mockImplementation(() => ({
      reset: vi.fn(),
      hasMore: vi.fn().mockReturnValueOnce(true).mockReturnValueOnce(true).mockReturnValue(false), // 2 frames then stop
      readNextBlock: vi.fn().mockReturnValue({ length: 10, data: new Uint8Array(10) }),
      seekToMessage: vi.fn().mockReturnValue(true),
      getMessageCount: vi.fn().mockReturnValue(100),
      getOffset: vi.fn().mockReturnValue(0),
      getProgress: vi.fn().mockReturnValue({ total: 1000, current: 0, percent: 0 }),
    }))
  };
});

// Mock NetworkMessageParser
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

describe('DemoPlaybackController with Tracking', () => {
  let controller: DemoPlaybackController;
  let tracker: ResourceLoadTracker;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new DemoPlaybackController();
    controller.setHandler({} as any);
    controller.loadDemo(new ArrayBuffer(100));
    tracker = new ResourceLoadTracker();
  });

  it('should update tracker frame/time during playback', async () => {
    const startSpy = vi.spyOn(tracker, 'startTracking');
    const stopSpy = vi.spyOn(tracker, 'stopTracking');
    const setFrameSpy = vi.spyOn(tracker, 'setCurrentFrame');
    const setTimeSpy = vi.spyOn(tracker, 'setCurrentTime');

    const playbackPromise = controller.playWithTracking(tracker);

    expect(startSpy).toHaveBeenCalled();
    expect(controller.getState()).toBe(PlaybackState.Playing);

    // Simulate 2 updates/frames (based on hasMore mock returning true twice)
    controller.update(0.1); // Frame 0
    controller.update(0.1); // Frame 1
    controller.update(0.1); // Frame 2 -> hasMore false -> finish

    await playbackPromise;

    expect(stopSpy).toHaveBeenCalled();
    expect(setFrameSpy).toHaveBeenCalledWith(0);
    expect(setFrameSpy).toHaveBeenCalledWith(1);
    expect(setTimeSpy).toHaveBeenCalled();
  });

  it('should handle playRangeWithTracking', async () => {
      // For this test we need a reader that lasts longer
      // We rely on previous mock structure but maybe we need to adjust hasMore

      const playbackPromise = controller.playRangeWithTracking(
          { type: 'frame', frame: 0 },
          { type: 'frame', frame: 1 },
          tracker
      );

      controller.update(0.1); // Frame 0
      controller.update(0.1); // Frame 1 -> Should pause and resolve

      await playbackPromise;

      expect(tracker['tracking']).toBe(false);
  });

  it('should handle fastForward mode', async () => {
    // Reset mocks for this test to ensure reader has enough frames
    const readerMock = (controller as any).reader;
    readerMock.hasMore.mockReturnValue(true);
    // Mock readNextBlock to decrement a counter or eventually return false/stop?
    // In fastForward, it loops until processNextFrame returns false.
    // processNextFrame returns false when reader.hasMore() is false.

    let frames = 5;
    readerMock.hasMore.mockImplementation(() => frames > 0);
    readerMock.readNextBlock.mockImplementation(() => {
        frames--;
        return { length: 10, data: new Uint8Array(10) };
    });

    const log = await controller.playWithTracking(tracker, { fastForward: true });

    expect(log).toBeDefined();
    expect(log.byFrame.size).toBe(0); // No actual resources recorded in this mock
    expect(readerMock.hasMore).toHaveBeenCalled();
    expect(tracker['tracking']).toBe(false);
  });
});
