import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DemoClipper } from '../../src/demo/clipper';
import { DemoReader } from '../../src/demo/demoReader';

// Mock DemoReader
vi.mock('../../src/demo/demoReader', () => {
  return {
    DemoReader: vi.fn().mockImplementation((buffer) => ({
      seekToMessage: vi.fn().mockReturnValue(true),
      getMessageCount: vi.fn().mockReturnValue(100),
      getOffset: vi.fn().mockReturnValue(0), // Simplified
      hasMore: vi.fn().mockReturnValue(false), // Stop immediately for default
      readNextBlock: vi.fn().mockReturnValue(null)
    }))
  };
});

// Mock NetworkMessageParser
vi.mock('../../src/demo/parser', async (importOriginal) => {
    const mod = await importOriginal();
    return {
        ...(mod as any),
        NetworkMessageParser: vi.fn().mockImplementation((buffer, handler) => ({
            setProtocolVersion: vi.fn(),
            parseMessage: vi.fn().mockImplementation(() => {
                if (handler && handler.onConfigString) {
                    handler.onConfigString(1, 'test');
                }
            })
        }))
    };
});

describe('DemoClipper', () => {
  let demoData: ArrayBuffer;

  beforeEach(() => {
    demoData = new ArrayBuffer(1000);
    vi.clearAllMocks();
  });

  it('should extract clip bytes', () => {
    // We need to control DemoReader mock return values to test extractClip
    // The implementation creates a NEW DemoReader(demoData) inside extractClip.

    // We can't easily mock return values per instance unless we use a factory or prototype mock.
    // Vitest mock factory above sets prototype.

    // Let's rely on the mock implementation behavior.
    // seekToMessage returns true.
    // getOffset returns 0 initially.

    // If we want getOffset to return different values for start and end:
    // We need state in the mock.

    const DemoReaderMock = vi.mocked(DemoReader);
    let offset = 0;

    DemoReaderMock.mockImplementation(() => ({
        seekToMessage: vi.fn().mockImplementation((idx) => {
            if (idx === 10) offset = 100;
            if (idx === 20) offset = 200;
            return true;
        }),
        getOffset: vi.fn().mockImplementation(() => offset),
        getMessageCount: vi.fn().mockReturnValue(100),
        hasMore: vi.fn(),
        readNextBlock: vi.fn(),
        reset: vi.fn(),
        getProgress: vi.fn(),
        readAllBlocksToBuffer: vi.fn(),
    }) as any);

    const clip = DemoClipper.extractClip(demoData, 10, 20);

    // startOffset = 100, endOffset = 200. Length = 100.
    // Plus 4 bytes for terminator?
    expect(clip.byteLength).toBe(104);

    // Check terminator
    const view = new DataView(clip.buffer);
    expect(view.getInt32(100, true)).toBe(-1);
  });

  it('should capture world state', async () => {
      // Need to mock reader iterating blocks
      const DemoReaderMock = vi.mocked(DemoReader);
      let frames = 0;

      DemoReaderMock.mockImplementation(() => ({
          hasMore: vi.fn().mockImplementation(() => frames < 5),
          readNextBlock: vi.fn().mockImplementation(() => {
              frames++;
              return { length: 0, data: new Uint8Array(0) }; // Empty block
          }),
          seekToMessage: vi.fn(),
          getMessageCount: vi.fn(),
          getOffset: vi.fn(),
          reset: vi.fn(),
          getProgress: vi.fn(),
          readAllBlocksToBuffer: vi.fn(),
      }) as any);

      const state = await DemoClipper.captureWorldState(demoData, 5);

      expect(state.configStrings.has(1)).toBe(true);
      expect(state.configStrings.get(1)).toBe('test');
  });
});
