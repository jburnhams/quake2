import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

const demoReaderMockClass = class {
  constructor() {
    return mockDemoReader;
  }
};

vi.mock('../../src/demo/demoReader.js', () => ({ DemoReader: demoReaderMockClass }));
vi.mock('../../src/demo/demoReader', () => ({ DemoReader: demoReaderMockClass }));

const parserMockImpl = class {
    constructor(data, handler) {
        (global as any).mockParserHandler = handler;
        return mockNetworkMessageParser;
    }
};

vi.mock('../../src/demo/parser.js', () => ({
  NetworkMessageParser: parserMockImpl,
  createEmptyEntityState: () => ({ number: 0, origin: { x:0, y:0, z:0 } }),
  createEmptyProtocolPlayerState: () => ({}),
}));
vi.mock('../../src/demo/parser', () => ({
  NetworkMessageParser: parserMockImpl,
  createEmptyEntityState: () => ({ number: 0, origin: { x:0, y:0, z:0 } }),
  createEmptyProtocolPlayerState: () => ({}),
}));

describe('DemoAnalyzer', () => {
  let analyzer: any; // Dynamic type
  let buffer: ArrayBuffer;

  beforeEach(async () => {
    vi.resetModules();
    buffer = new ArrayBuffer(0);
    // Dynamic import to respect resetModules
    const { DemoAnalyzer } = await import('../../src/demo/analyzer.js');
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
    const pickupEvent = result.events.find((e: any) => e.type === DemoEventType.Pickup);
    expect(pickupEvent).toBeDefined();
    expect(pickupEvent?.description).toContain('You got the Shotgun');
  });

  it('should detect spawn events when new entities appear', () => {
    // Setup mock reader to return two blocks (two frames)
    mockDemoReader.hasMore.mockReturnValueOnce(true).mockReturnValueOnce(true).mockReturnValue(false);
    mockDemoReader.readNextBlock.mockReturnValue({ length: 10, data: new ArrayBuffer(10) });

    analyzer.analyze();
  });
});
