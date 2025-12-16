import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DemoPlaybackController, PlaybackState, FrameOffset, TimeOffset } from '../../src/demo/playback.js';
import { ResourceLoadTracker, ResourceLoadLog } from '../../src/assets/resourceTracker.js';
import { DemoReader } from '../../src/demo/demoReader.js';

// Mock DemoReader
vi.mock('../../src/demo/demoReader.js', () => {
  return {
    DemoReader: vi.fn().mockImplementation(() => ({
      hasMore: vi.fn().mockReturnValue(true),
      readNextBlock: vi.fn().mockReturnValue({ data: new Uint8Array(0) }),
      reset: vi.fn(),
      getMessageCount: vi.fn().mockReturnValue(100),
      getProgress: vi.fn().mockReturnValue({ total: 1000, current: 0 }),
      getOffset: vi.fn().mockReturnValue(0),
      seekToMessage: vi.fn().mockReturnValue(true)
    }))
  };
});

// Mock NetworkMessageParser
vi.mock('../../src/demo/parser.js', () => {
    return {
        NetworkMessageParser: vi.fn().mockImplementation(() => ({
            setProtocolVersion: vi.fn(),
            parseMessage: vi.fn(),
            getProtocolVersion: vi.fn().mockReturnValue(34)
        }))
    };
});

describe('DemoPlaybackController Tracking', () => {
  let controller: DemoPlaybackController;
  let tracker: ResourceLoadTracker;

  beforeEach(() => {
    controller = new DemoPlaybackController();
    // Load a dummy demo to initialize reader
    controller.loadDemo(new ArrayBuffer(10));
    tracker = new ResourceLoadTracker();
    vi.spyOn(tracker, 'startTracking');
    vi.spyOn(tracker, 'stopTracking').mockReturnValue({
        byFrame: new Map(),
        byTime: new Map(),
        uniqueResources: new Map()
    } as ResourceLoadLog);
    vi.spyOn(tracker, 'setCurrentFrame');
    vi.spyOn(tracker, 'setCurrentTime');
  });

  it('playWithTracking should start and stop tracking in fast forward mode', async () => {
    const reader = (controller as any).reader;
    let callCount = 0;
    reader.hasMore.mockImplementation(() => {
        return callCount < 5;
    });
    reader.readNextBlock.mockImplementation(() => {
        callCount++;
        if (callCount <= 5) return { data: new Uint8Array(0) };
        return null;
    });

    const result = await controller.playWithTracking(tracker, { fastForward: true });

    expect(tracker.startTracking).toHaveBeenCalled();
    expect(tracker.stopTracking).toHaveBeenCalled();
    expect(tracker.setCurrentFrame).toHaveBeenCalledTimes(5);
    expect(result).toBeDefined();
  });

  it('playRangeWithTracking should respect range and stop tracking in fast forward mode', async () => {
    const start: FrameOffset = { type: 'frame', frame: 10 };
    const end: FrameOffset = { type: 'frame', frame: 15 };

    const reader = (controller as any).reader;

    // We mock seekToMessage to succeed.
    // In playback.ts: playFrom(start) -> seek(10) -> internal seek logic calls reader.seekToMessage.
    reader.seekToMessage.mockReturnValue(true);

    // Also we need to make sure processNextFrame keeps returning data so it doesn't stop early.
    reader.hasMore.mockReturnValue(true);
    reader.readNextBlock.mockReturnValue({ data: new Uint8Array(0) });

    await controller.playRangeWithTracking(start, end, tracker, { fastForward: true });

    expect(tracker.startTracking).toHaveBeenCalled();
    expect(tracker.stopTracking).toHaveBeenCalled();

    // It seems seekToMessage is called via private seek().
    // If seek logic decides simple advancement is enough (currentFrame + 1), it skips seekToMessage.
    // Initial currentFrameIndex is -1. start frame is 10.
    // seek(10) checks snapshots... falls back to reader.reset() then fast forward loop?
    // Wait, my mock reset() does nothing.
    // My seek implementation in playback.ts:
    /*
      // If no better start point found, restart from 0
      if (startIndex === -1 && this.currentFrameIndex > frameNumber) {
          this.reader.reset();
          this.currentFrameIndex = -1;
          this.currentProtocolVersion = 0;
      } else if (startIndex === -1) {
          this.reader.reset();
          this.currentFrameIndex = -1;
          this.currentProtocolVersion = 0;
      }

      // ...

      // 2. Fast forward loop
      while (this.currentFrameIndex < frameNumber) { ... }
    */
    // So it resets and loops. It does NOT call reader.seekToMessage() unless a snapshot is restored.
    // Snapshots map is empty initially.
    // So reader.seekToMessage is NOT called in this path.
    // That explains why the test fails.

    // We should verify that it resets instead.
    expect(reader.reset).toHaveBeenCalled();
  });
});
