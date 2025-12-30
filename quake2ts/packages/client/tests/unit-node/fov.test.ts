import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createClient, ClientExports, ClientImports } from '@quake2ts/client/index.js';
import { AssetManager, Renderer, EngineImports, EngineHost } from '@quake2ts/engine';
import { createMockRenderer } from '@quake2ts/test-utils';

// Mock dependencies
const mockAssets = {
  loadMd2Model: vi.fn().mockResolvedValue({}),
  loadMd3Model: vi.fn().mockResolvedValue({}),
  loadSprite: vi.fn().mockResolvedValue({}),
  loadSound: vi.fn().mockResolvedValue({}),
  loadTexture: vi.fn().mockResolvedValue({}),
} as unknown as AssetManager;

// Use createMockRenderer to ensure we have all methods including registerTexture
const mockRenderer = createMockRenderer({
  width: 800,
  height: 600,
  // Ensure registerTexture returns a valid object that has 'width' property for Init_Hud
  registerPic: vi.fn().mockResolvedValue({ width: 32, height: 32 }),
  registerTexture: vi.fn().mockReturnValue({ width: 64, height: 64 }),
  getPerformanceReport: vi.fn().mockReturnValue({ textureBinds: 0, drawCalls: 0, triangles: 0, vertices: 0 }),
});

const mockTrace = vi.fn().mockReturnValue({
  fraction: 1,
  endpos: { x: 0, y: 0, z: 0 },
  plane: { normal: { x: 0, y: 0, z: 1 }, dist: 0 },
  ent: -1
});

const mockCvars = {
  register: vi.fn(),
  get: vi.fn(),
  list: vi.fn().mockReturnValue([]), // Added list method
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
  pointcontents: vi.fn().mockReturnValue(0), // Mock pointcontents for checkWater
} as any;

describe('Client FOV and View', () => {
  let client: ClientExports;
  let fovCallback: (cvar: any) => void;

  beforeEach(async () => { // Make async to handle async Init
    vi.clearAllMocks();

    // Re-apply mocks in beforeEach in case clearAllMocks wipes them out

    // Explicitly using mockImplementation to ensure it works even if createMockRenderer was called once
    mockRenderer.getPerformanceReport = vi.fn().mockReturnValue({ textureBinds: 0, drawCalls: 0, triangles: 0, vertices: 0 });

    // Fix registerPic returning a Promise or not?
    // Init_Hud expects registerTexture, but cgameBridge might use registerPic (if it exists on renderer in engine)
    // The renderer interface has registerTexture which returns a Pic.
    // Wait, renderer.registerTexture returns a Pic (object), not a Promise.

    mockRenderer.registerTexture = vi.fn().mockReturnValue({ width: 64, height: 64 });
    mockRenderer.registerPic = vi.fn().mockReturnValue({ width: 32, height: 32 }); // Use sync return if that matches interface


    // Ensure trace returns a valid result every time
    mockTrace.mockReturnValue({
      fraction: 1,
      endpos: { x: 0, y: 0, z: 0 },
      plane: { normal: { x: 0, y: 0, z: 1 }, dist: 0 },
      ent: -1
    });

    // Ensure list returns empty array by default
    (mockCvars.list as any).mockReturnValue([]);

    // Capture the callback for 'fov' cvar registration
    (mockCvars.register as any).mockImplementation((def: any) => {
      if (def.name === 'fov') {
        fovCallback = def.onChange;
      }
      return {
          name: def.name,
          defaultValue: def.defaultValue,
          string: def.defaultValue, // Mock string getter
          number: parseFloat(def.defaultValue),
      };
    });

    (mockCvars.get as any).mockImplementation((name: string) => {
        if (name === 'fov') {
            return { number: 90 }; // Initial value
        }
    });

    client = createClient({ engine: mockEngine, host: mockHost } as ClientImports);
    await client.Init(); // Initialize client including CGame, await it
  });

  it('should register fov cvar', () => {
    expect(mockCvars.register).toHaveBeenCalledWith(expect.objectContaining({
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

    // Change FOV via callback
    // The actual implementation passes the Cvar object to the callback
    fovCallback({ number: 110 } as any);

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

    fovCallback({ number: 180 } as any); // Too high
    client.render({ latest: initialFrame, previous: initialFrame, alpha: 0 });
    expect(client.camera?.fov).toBe(179);

    fovCallback({ number: 0 } as any); // Too low
    client.render({ latest: initialFrame, previous: initialFrame, alpha: 0 });
    expect(client.camera?.fov).toBe(1);
  });
});
