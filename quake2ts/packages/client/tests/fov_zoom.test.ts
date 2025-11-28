import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createClient, ClientExports, ClientImports } from '../src/index.js';
import { AssetManager, Renderer, EngineImports, EngineHost } from '@quake2ts/engine';

// Mock dependencies
const mockAssets = {
  loadMd2Model: vi.fn().mockResolvedValue({}),
  loadMd3Model: vi.fn().mockResolvedValue({}),
  loadSprite: vi.fn().mockResolvedValue({}),
  loadSound: vi.fn().mockResolvedValue({}),
  loadTexture: vi.fn().mockResolvedValue({}),
} as unknown as AssetManager;

const mockRenderer = {
  registerTexture: vi.fn(),
  begin2D: vi.fn(),
  end2D: vi.fn(),
  drawfillRect: vi.fn(),
  drawCenterString: vi.fn(),
  drawString: vi.fn(),
  renderFrame: vi.fn(),
  width: 800,
  height: 600,
} as unknown as Renderer;

const mockTrace = vi.fn().mockReturnValue({
  fraction: 1,
  endpos: { x: 0, y: 0, z: 0 },
  plane: { normal: { x: 0, y: 0, z: 1 }, dist: 0 },
  ent: -1
});

const mockCvars = {
  register: vi.fn(),
  get: vi.fn(),
  list: vi.fn().mockReturnValue([]), // Added list
};

const mockCommands = {
  register: vi.fn(),
};

const mockHost = {
  commands: mockCommands,
  cvars: mockCvars,
} as unknown as EngineHost;

const mockEngine: EngineImports & { renderer: Renderer } = {
  assets: mockAssets,
  renderer: mockRenderer,
  trace: mockTrace,
} as any;

describe('Client FOV and Zoom', () => {
  let client: ClientExports;
  let fovCallback: (val: string) => void;
  let zoomStartCallback: () => void;
  let zoomEndCallback: () => void;

  beforeEach(() => {
    vi.clearAllMocks();

    // Ensure list returns empty array
    (mockCvars.list as any).mockReturnValue([]);

    // Capture callbacks
    (mockCvars.register as any).mockImplementation((name: string, def: string, flags: number, callback: any) => {
      if (name === 'fov') {
        fovCallback = callback;
      }
    });

    (mockCommands.register as any).mockImplementation((name: string, callback: any) => {
      if (name === '+zoom') zoomStartCallback = callback;
      if (name === '-zoom') zoomEndCallback = callback;
    });

    client = createClient({ engine: mockEngine, host: mockHost } as ClientImports);
  });

  it('should zoom in when +zoom is executed', () => {
    const frame = {
      state: {
        origin: { x: 0, y: 0, z: 0 },
        viewAngles: { x: 0, y: 0, z: 0 },
        velocity: { x: 0, y: 0, z: 0 },
        pmFlags: 0,
        waterLevel: 0,
        health: 100,
        armor: 0,
        ammo: 0,
        blend: [0, 0, 0, 0],
        stats: [],
        kick_angles: { x: 0, y: 0, z: 0 },
        gunoffset: { x: 0, y: 0, z: 0 },
        gunangles: { x: 0, y: 0, z: 0 },
        gunindex: 0,
        client: {
            inventory: {
                armor: null,
                items: new Set(),
                ammo: { counts: [] },
                keys: new Set(),
                powerups: new Map()
            },
            weapon: { state: 0 }
        }
      } as any,
      timeMs: 100,
      serverFrame: 1
    };

    // Standard render
    client.render({ latest: frame, previous: frame, alpha: 0 });
    expect(client.camera?.fov).toBe(90);

    // Start zoom
    zoomStartCallback();

    // Render again
    client.render({ latest: frame, previous: frame, alpha: 0 });
    expect(client.camera?.fov).toBe(40);

    // End zoom
    zoomEndCallback();

    // Render again
    client.render({ latest: frame, previous: frame, alpha: 0 });
    expect(client.camera?.fov).toBe(90);
  });
});
