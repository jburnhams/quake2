import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DemoPlaybackController, PlaybackState, FrameOffset, TimeOffset } from '../../src/demo/playback';
import { ResourceLoadTracker, ResourceLoadLog } from '../../src/assets/resourceTracker';
import { NetworkMessageParser } from '../../src/demo/parser';
import { DemoReader } from '../../src/demo/demoReader';

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

// Mock DemoReader
// Use a single mock call without extension to match TypeScript import resolution
vi.mock('../../src/demo/demoReader', () => {
  return {
    DemoReader: class {
        constructor() {
            return {
                reset: vi.fn(),
                hasMore: vi.fn().mockReturnValue(true), // Default true
                readNextBlock: vi.fn().mockReturnValue({ length: 10, data: dummyStream }),
                seekToMessage: vi.fn().mockReturnValue(true),
                getMessageCount: vi.fn().mockReturnValue(100),
                getOffset: vi.fn().mockReturnValue(0),
                getProgress: vi.fn().mockReturnValue({ total: 1000, current: 0, percent: 0 }),
            };
        }
    }
  };
});

describe('DemoPlaybackController with Tracking', () => {
  let controller: DemoPlaybackController;
  let tracker: ResourceLoadTracker;

  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // Spy on parseMessage
    vi.spyOn(NetworkMessageParser.prototype, 'parseMessage').mockImplementation(function(this: any) {
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
    vi.spyOn(NetworkMessageParser.prototype, 'setProtocolVersion').mockImplementation(() => {});
    vi.spyOn(NetworkMessageParser.prototype, 'getProtocolVersion').mockReturnValue(34);

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

    // Access reader mock instance
    const readerMock = (controller as any).reader;

    // Setup reader behavior: 2 frames then stop
    readerMock.hasMore
        .mockReturnValueOnce(true) // Start check
        .mockReturnValueOnce(true) // Frame 0
        .mockReturnValueOnce(true) // Frame 1
        .mockReturnValue(false);   // Stop

    const playbackPromise = controller.playWithTracking(tracker);

    expect(startSpy).toHaveBeenCalled();
    expect(controller.getState()).toBe(PlaybackState.Playing);

    // Frame 0
    controller.update(0.1);
    // Frame 1
    controller.update(0.1);
    // Frame 2 (should finish)
    controller.update(0.1);

    await playbackPromise;

    expect(stopSpy).toHaveBeenCalled();
    expect(setFrameSpy).toHaveBeenCalledWith(0);
    expect(setFrameSpy).toHaveBeenCalledWith(1);
    expect(setTimeSpy).toHaveBeenCalled();
  });

  it('should handle playRangeWithTracking', async () => {
      const reader = (controller as any).reader;
      reader.hasMore.mockReturnValue(true);

      const playbackPromise = controller.playRangeWithTracking(
          { type: 'frame', frame: 0 },
          { type: 'frame', frame: 1 },
          tracker
      );

      controller.update(0.1); // Frame 0
      controller.update(0.1); // Frame 1 -> Should pause and resolve

      // Update more to trigger completion if needed
      controller.update(0.1);

      await playbackPromise;

      expect(tracker['tracking']).toBe(false);
  });

  it('should handle fastForward mode', async () => {
    const reader = (controller as any).reader;
    let frames = 5;

    reader.hasMore.mockImplementation(() => frames > 0);
    reader.readNextBlock.mockImplementation(() => {
        frames--;
        return { length: 10, data: dummyStream };
    });

    const log = await controller.playWithTracking(tracker, { fastForward: true });

    expect(log).toBeDefined();
    expect(log.byFrame.size).toBe(0); // No actual resources recorded in this mock
    expect(reader.hasMore).toHaveBeenCalled();
    expect(tracker['tracking']).toBe(false);
  });
});
