import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DemoPlaybackController } from '../../src/demo/playback.js';
import { DemoReader } from '../../src/demo/demoReader.js';
import { DemoAnalyzer } from '../../src/demo/analyzer.js';
import { DemoHeader, ServerInfo } from '../../src/demo/analysis.js';

// Mock dependencies
vi.mock('../../src/demo/demoReader.js');
vi.mock('../../src/demo/analyzer.js');

describe('DemoPlaybackController Metadata', () => {
  let controller: DemoPlaybackController;
  let mockAnalyzer: any;

  beforeEach(() => {
    controller = new DemoPlaybackController();

    // Mock DemoAnalyzer to return fake analysis results
    mockAnalyzer = {
      analyze: vi.fn().mockReturnValue({
        events: [],
        summary: {},
        header: {
          levelName: 'base1',
          protocolVersion: 34,
          tickRate: 10,
          gameDir: 'baseq2',
          playerNum: 0
        } as DemoHeader,
        configStrings: new Map(),
        serverInfo: {
          hostname: 'Test Server'
        } as ServerInfo,
        statistics: {},
        playerStats: new Map(),
        weaponStats: new Map()
      })
    };
    (DemoAnalyzer as any).mockImplementation(() => mockAnalyzer);
  });

  it('should return null metadata if no demo is loaded', () => {
    expect(controller.getMetadata()).toBeNull();
  });

  it('should return correct metadata after loading and analyzing demo', () => {
    // Load fake demo buffer
    const buffer = new ArrayBuffer(100);
    controller.loadDemo(buffer);

    const metadata = controller.getMetadata();

    expect(metadata).not.toBeNull();
    expect(metadata?.mapName).toBe('base1');
    expect(metadata?.demoVersion).toBe(34);
    expect(metadata?.tickRate).toBe(10);
    expect(metadata?.serverName).toBe('Test Server');
    // Player name logic is placeholder currently
    expect(metadata?.playerName).toBe('Unknown');
  });
});
