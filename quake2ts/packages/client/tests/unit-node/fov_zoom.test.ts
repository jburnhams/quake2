import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { createClient, ClientExports, ClientImports } from '@quake2ts/client/index.js';
import { AssetManager, Renderer } from '@quake2ts/engine';
import { createMockEngineHost, createMockEngineImports, createMockLocalStorage, createPlayerStateFactory, createPlayerClientFactory } from '@quake2ts/test-utils';

describe('Client FOV and Zoom', () => {
  let client: ClientExports;
  let zoomStartCallback: () => void;
  let zoomEndCallback: () => void;

  beforeEach(async () => {
    // Mock localStorage
    const mockStorage = createMockLocalStorage();
    vi.stubGlobal('localStorage', mockStorage);

    const mockEngine = createMockEngineImports({
        trace: vi.fn().mockReturnValue({
            fraction: 1,
            endpos: { x: 0, y: 0, z: 0 },
            plane: { normal: { x: 0, y: 0, z: 1 }, dist: 0 },
            ent: -1
        })
    });

    // Setup assets
    (mockEngine.assets.loadMd2Model as Mock).mockResolvedValue({});
    (mockEngine.assets.loadMd3Model as Mock).mockResolvedValue({});
    (mockEngine.assets.loadSprite as Mock).mockResolvedValue({});
    (mockEngine.assets.loadSound as Mock).mockResolvedValue({});
    (mockEngine.assets.loadTexture as Mock).mockResolvedValue({});

    // Setup renderer
    (mockEngine.renderer.registerPic as Mock).mockResolvedValue({ width: 32, height: 32 });
    (mockEngine.renderer.registerTexture as Mock).mockReturnValue({ width: 64, height: 64 });
    (mockEngine.renderer.getPerformanceReport as Mock).mockReturnValue({ textureBinds: 0, drawCalls: 0, triangles: 0, vertices: 0 });

    const mockHost = createMockEngineHost();

    // Capture command callbacks
    // We spy on the mock implementation to capture the callback
    (mockHost.commands.register as Mock).mockImplementation((name: string, callback: any) => {
        if (name === '+zoom') zoomStartCallback = callback;
        if (name === '-zoom') zoomEndCallback = callback;
    });

    // Helper for Cvars
    (mockHost.cvars.register as Mock).mockImplementation((def: any) => {
         return {
            name: def.name,
            defaultValue: def.defaultValue,
            string: def.defaultValue,
            number: parseFloat(def.defaultValue),
            onChange: def.onChange
        };
    });

    client = createClient({ engine: mockEngine, host: mockHost } as unknown as ClientImports);
    await client.Init();
  });

  it('should zoom in when +zoom is executed', () => {
    // Construct a frame state using PlayerState factory instead of Entity factory
    // This aligns better with what the client expects (GameFrameResult['state'])
    const playerState = createPlayerStateFactory({
        origin: { x: 0, y: 0, z: 0 },
        viewAngles: { x: 0, y: 0, z: 0 },
        velocity: { x: 0, y: 0, z: 0 },
        waterLevel: 0,
        pm_flags: 0,
        blend: [0, 0, 0, 0],
        stats: [],
        kick_angles: { x: 0, y: 0, z: 0 },
        gunoffset: { x: 0, y: 0, z: 0 },
        gunangles: { x: 0, y: 0, z: 0 },
        gunindex: 0
    });

    // Compose with client property and other fields not in base PlayerState but used in snapshot
    // Note: The snapshot state is a union of PlayerState and other things in the real game code.
    const state = {
        ...playerState,
        client: createPlayerClientFactory(),
        health: 100, // Explicitly add health/armor/ammo if they are top-level on snapshot
        armor: 0,
        ammo: 0
    };

    const frame = {
      state: state,
      timeMs: 100,
      serverFrame: 1
    };

    client.render({ latest: frame as any, previous: frame as any, alpha: 0 });
    expect(client.camera?.fov).toBe(90);

    // zoomStartCallback might be undefined if initialization failed or logic changed
    if (zoomStartCallback) zoomStartCallback();

    client.render({ latest: frame as any, previous: frame as any, alpha: 0 });
    expect(client.camera?.fov).toBe(40);

    if (zoomEndCallback) zoomEndCallback();

    client.render({ latest: frame as any, previous: frame as any, alpha: 0 });
    expect(client.camera?.fov).toBe(90);
  });
});
