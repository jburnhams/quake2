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
} as any;

describe('Client FOV and View', () => {
  let client: ClientExports;
  let fovCallback: (cvar: any) => void;

  beforeEach(() => {
    vi.clearAllMocks();

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
