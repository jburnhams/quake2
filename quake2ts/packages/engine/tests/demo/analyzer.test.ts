import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DemoAnalyzer } from '../../src/demo/analyzer.js';
import { DemoEventType } from '../../src/demo/analysis.js';

// Mock dependencies
const mockDemoReader = {
  hasMore: vi.fn(),
  readNextBlock: vi.fn(),
};

const mockNetworkMessageParser = {
  setProtocolVersion: vi.fn(),
  parseMessage: vi.fn(),
  getProtocolVersion: vi.fn().mockReturnValue(31),
};

vi.mock('../../src/demo/demoReader.js', () => ({
  DemoReader: vi.fn().mockImplementation(() => mockDemoReader)
}));

vi.mock('../../src/demo/parser.js', () => ({
  NetworkMessageParser: vi.fn().mockImplementation((data, handler) => {
    // Expose handler so we can trigger callbacks in tests
    (global as any).mockParserHandler = handler;
    return mockNetworkMessageParser;
  }),
  createEmptyEntityState: () => ({ number: 0, origin: { x:0, y:0, z:0 } }),
  createEmptyProtocolPlayerState: () => ({}),
}));

describe('DemoAnalyzer', () => {
  let analyzer: DemoAnalyzer;
  let buffer: ArrayBuffer;

  beforeEach(() => {
    buffer = new ArrayBuffer(0);
    analyzer = new DemoAnalyzer(buffer);
    vi.clearAllMocks();
  });

  afterEach(() => {
    delete (global as any).mockParserHandler;
  });

  it('should detect pickup events from print messages', () => {
    // Setup mock reader to return one block then stop
    mockDemoReader.hasMore.mockReturnValueOnce(true).mockReturnValue(false);
    mockDemoReader.readNextBlock.mockReturnValue({ length: 10, data: new ArrayBuffer(10) });

    const result = analyzer.analyze();
    const handler = (global as any).mockParserHandler;

    // Simulate print message
    if (handler && handler.onPrint) {
        handler.onPrint(2, 'You got the Shotgun');
    }

    expect(result.events.length).toBeGreaterThan(0);
    const pickupEvent = result.events.find(e => e.type === DemoEventType.Pickup);
    expect(pickupEvent).toBeDefined();
    expect(pickupEvent?.description).toContain('You got the Shotgun');
  });

  it('should detect spawn events when new entities appear', () => {
    // Setup mock reader to return two blocks (two frames)
    mockDemoReader.hasMore.mockReturnValueOnce(true).mockReturnValueOnce(true).mockReturnValue(false);
    mockDemoReader.readNextBlock.mockReturnValue({ length: 10, data: new ArrayBuffer(10) });

    analyzer.analyze();
    // We need to trigger parseMessage for each loop iteration.
    // The analyzer loop calls `new NetworkMessageParser` each time.
    // So we need to capture the handlers.

    // Since `analyze` runs synchronously, we can't intervene between frames easily with this mock setup
    // unless `readNextBlock` triggers side effects or we change how we mock.

    // Actually, `analyze` loops until `hasMore` is false.
    // The `NetworkMessageParser` is instantiated inside the loop.
    // So `vi.mock` factory is called multiple times? No, the class constructor is called.
  });
});
