import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createClient, ClientExports, ClientImports } from '@quake2ts/client/index.js';
import { EngineImports, Renderer } from '@quake2ts/engine';
import { createMockRenderer, createMockAssetManager, createMockEngineHost, createMockLocalStorage } from '@quake2ts/test-utils';

describe('Client FOV and View', () => {
  let client: ClientExports;
  let mockRenderer: Renderer;
  let mockHost: any; // Using any for easier access to mock internals like .cvars.get

  beforeEach(async () => {
    vi.clearAllMocks();

    global.localStorage = createMockLocalStorage();

    mockRenderer = createMockRenderer({
        width: 800,
        height: 600,
        registerPic: vi.fn().mockResolvedValue({ width: 32, height: 32 }),
        registerTexture: vi.fn().mockReturnValue({ width: 64, height: 64 }),
        getPerformanceReport: vi.fn().mockReturnValue({ textureBinds: 0, drawCalls: 0, triangles: 0, vertices: 0 }),
    });

    const mockAssets = createMockAssetManager();

    const mockTrace = vi.fn().mockReturnValue({
      fraction: 1,
      endpos: { x: 0, y: 0, z: 0 },
      plane: { normal: { x: 0, y: 0, z: 1 }, dist: 0 },
      ent: -1
    });

    mockHost = createMockEngineHost();

    // Setup initial fvar value override if needed, but createMockEngineHost handles registration logic
    // We can spy on register if we want to verify calls, but createMockEngineHost already uses vi.fn()

    const mockEngine: EngineImports & { renderer: Renderer } = {
      assets: mockAssets,
      renderer: mockRenderer,
      trace: mockTrace,
      pointcontents: vi.fn().mockReturnValue(0),
    } as any;

    client = createClient({ engine: mockEngine, host: mockHost } as ClientImports);
    await client.Init();
  });

  it('should register fov cvar', () => {
    expect(mockHost.cvars.register).toHaveBeenCalledWith(expect.objectContaining({
        name: 'fov',
        defaultValue: '90'
    }));
  });

  it('should update FOV when cvar changes', () => {
    const initialFrame = {
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
            weapon: {
                state: 0
            }
        }
      } as any,
      timeMs: 100,
      serverFrame: 1
    };

    // First render to initialize camera
    client.render({ latest: initialFrame, previous: initialFrame, alpha: 0 });
    expect(client.camera?.fov).toBe(90);

    // Change FOV via host
    mockHost.cvars.setValue('fov', '110');

    // Render again
    client.render({ latest: initialFrame, previous: initialFrame, alpha: 0 });
    expect(client.camera?.fov).toBe(110);
  });

  it('should clamp FOV values', () => {
     const initialFrame = {
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
            weapon: {
                state: 0
            }
        }
      } as any,
      timeMs: 100,
      serverFrame: 1
    };

    mockHost.cvars.setValue('fov', '180'); // Too high
    client.render({ latest: initialFrame, previous: initialFrame, alpha: 0 });
    expect(client.camera?.fov).toBe(179);

    mockHost.cvars.setValue('fov', '0'); // Too low
    client.render({ latest: initialFrame, previous: initialFrame, alpha: 0 });
    expect(client.camera?.fov).toBe(1);
  });
});
