import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DemoPlaybackController, PlaybackState, FrameOffset, TimeOffset } from '../../src/demo/playback.js';
import { ResourceLoadTracker, ResourceLoadLog } from '../../src/assets/resourceTracker.js';
import { DemoReader } from '../../src/demo/demoReader.js';
import { BinaryStream } from '@quake2ts/shared';

// Mock DemoReader with extension
vi.mock('../../src/demo/demoReader.js', () => {
  return {
    DemoReader: vi.fn().mockImplementation(() => {
        return {
            hasMore: vi.fn().mockReturnValue(true),
            readNextBlock: vi.fn().mockReturnValue({ data: new Uint8Array(0) }),
            reset: vi.fn(),
            getMessageCount: vi.fn().mockReturnValue(100),
            getProgress: vi.fn().mockReturnValue({ total: 1000, current: 0 }),
            getOffset: vi.fn().mockReturnValue(0),
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
              hasMore: vi.fn().mockReturnValue(true),
              readNextBlock: vi.fn().mockReturnValue({ data: new Uint8Array(0) }),
              reset: vi.fn(),
              getMessageCount: vi.fn().mockReturnValue(100),
              getProgress: vi.fn().mockReturnValue({ total: 1000, current: 0 }),
              getOffset: vi.fn().mockReturnValue(0),
              seekToMessage: vi.fn().mockReturnValue(true)
          };
      })
    };
  });

// Mock NetworkMessageParser with extension
vi.mock('../../src/demo/parser.js', () => {
    return {
        NetworkMessageParser: vi.fn().mockImplementation(() => ({
            setProtocolVersion: vi.fn(),
            parseMessage: vi.fn(),
            getProtocolVersion: vi.fn().mockReturnValue(34)
        }))
    };
});

// Mock NetworkMessageParser without extension
vi.mock('../../src/demo/parser', () => {
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
    vi.clearAllMocks();
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

    if (!vi.isMockFunction(reader.hasMore)) {
        vi.spyOn(reader, 'hasMore');
        vi.spyOn(reader, 'readNextBlock');
    }

    const mockHasMore = (reader.hasMore as any);
    const mockReadNextBlock = (reader.readNextBlock as any);

    let callCount = 0;
    mockHasMore.mockImplementation(() => {
        return callCount < 5;
    });

    // Create a dummy BinaryStream-like object to satisfy NetworkMessageParser if real one runs
    const dummyData = {
        hasBytes: () => false, // Empty
        readByte: () => -1,
        readShort: () => 0,
        readLong: () => 0,
        readFloat: () => 0,
        readString: () => '',
        readData: () => new Uint8Array(0),
        getReadPosition: () => 0,
        setReadPosition: () => {}
    };

    mockReadNextBlock.mockImplementation(() => {
        callCount++;
        if (callCount <= 5) return { data: dummyData };
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

    if (!vi.isMockFunction(reader.seekToMessage)) {
        vi.spyOn(reader, 'seekToMessage');
        vi.spyOn(reader, 'hasMore');
        vi.spyOn(reader, 'readNextBlock');
        vi.spyOn(reader, 'reset');
    }

    const mockSeekToMessage = (reader.seekToMessage as any);
    const mockHasMore = (reader.hasMore as any);
    const mockReadNextBlock = (reader.readNextBlock as any);

    const dummyData = {
        hasBytes: () => false,
        readByte: () => -1
    };

    mockSeekToMessage.mockReturnValue(true);
    mockHasMore.mockReturnValue(true);
    mockReadNextBlock.mockReturnValue({ data: dummyData });

    await controller.playRangeWithTracking(start, end, tracker, { fastForward: true });

    expect(tracker.startTracking).toHaveBeenCalled();
    expect(tracker.stopTracking).toHaveBeenCalled();

    expect(reader.reset).toHaveBeenCalled();
  });
});
