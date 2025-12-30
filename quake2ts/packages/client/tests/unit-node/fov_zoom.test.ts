import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createClient, ClientExports, ClientImports } from '@quake2ts/client/index.js';
import { AssetManager, Renderer, EngineImports, EngineHost } from '@quake2ts/engine';
import { createMockRenderer } from '@quake2ts/test-utils';

const mockAssets = {
  loadMd2Model: vi.fn(),
  loadMd3Model: vi.fn(),
  loadSprite: vi.fn(),
  loadSound: vi.fn(),
  loadTexture: vi.fn(),
} as unknown as AssetManager;

const mockRenderer = createMockRenderer();

const mockTrace = vi.fn();

const mockCvars = {
  register: vi.fn(),
  get: vi.fn(),
  list: vi.fn(),
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

  beforeEach(async () => {
    // Mock localStorage
    global.localStorage = {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
        length: 0,
        key: vi.fn(),
    };

    mockTrace.mockReturnValue({
      fraction: 1,
      endpos: { x: 0, y: 0, z: 0 },
      plane: { normal: { x: 0, y: 0, z: 1 }, dist: 0 },
      ent: -1
    });

    (mockAssets.loadMd2Model as any).mockResolvedValue({});
    (mockAssets.loadMd3Model as any).mockResolvedValue({});
    (mockAssets.loadSprite as any).mockResolvedValue({});
    (mockAssets.loadSound as any).mockResolvedValue({});
    (mockAssets.loadTexture as any).mockResolvedValue({});

    mockRenderer.registerPic.mockResolvedValue({ width: 32, height: 32 });
    mockRenderer.registerTexture.mockReturnValue({ width: 64, height: 64 });
    mockRenderer.getPerformanceReport.mockReturnValue({ textureBinds: 0, drawCalls: 0, triangles: 0, vertices: 0 });

    (mockCvars.list as any).mockReturnValue([]);
    (mockCvars.register as any).mockImplementation((def: any) => {
      if (def.name === 'fov') {
        fovCallback = def.onChange;
      }
      return {
          name: def.name,
          defaultValue: def.defaultValue,
          string: def.defaultValue,
          number: parseFloat(def.defaultValue),
      };
    });

    (mockCommands.register as any).mockImplementation((name: string, callback: any) => {
      if (name === '+zoom') zoomStartCallback = callback;
      if (name === '-zoom') zoomEndCallback = callback;
    });

    client = createClient({ engine: mockEngine, host: mockHost } as ClientImports);
    await client.Init();
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

    client.render({ latest: frame, previous: frame, alpha: 0 });
    expect(client.camera?.fov).toBe(90);

    zoomStartCallback();

    client.render({ latest: frame, previous: frame, alpha: 0 });
    expect(client.camera?.fov).toBe(40);

    zoomEndCallback();

    client.render({ latest: frame, previous: frame, alpha: 0 });
    expect(client.camera?.fov).toBe(90);
  });
});
