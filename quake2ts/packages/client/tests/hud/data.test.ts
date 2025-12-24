import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createClient, ClientImports } from '../../src/index.js';
import { createMockAssetManager, createMockRenderer } from '@quake2ts/test-utils';

// Mocks
vi.mock('@quake2ts/cgame', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...(actual as object),
        ClientPrediction: vi.fn().mockImplementation(() => ({
            setAuthoritative: vi.fn(),
            getPredictedState: vi.fn(() => ({
                health: 100,
                armor: 50,
                ammo: 25,
                pickupIcon: 'icons/armor',
                damageIndicators: []
            })),
            enqueueCommand: vi.fn(),
            decayError: vi.fn()
        })),
        GetCGameAPI: vi.fn(() => ({
            Init: vi.fn(),
            Shutdown: vi.fn(),
            DrawHUD: vi.fn(),
            ParseCenterPrint: vi.fn(),
            NotifyMessage: vi.fn(),
            ParseConfigString: vi.fn(),
            ShowSubtitle: vi.fn()
        }))
    };
});

vi.mock('@quake2ts/engine', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...(actual as object),
        DemoPlaybackController: vi.fn().mockImplementation(() => ({
            loadDemo: vi.fn(),
            setHandler: vi.fn(),
            update: vi.fn(),
            getCurrentTime: vi.fn(() => 0),
            getInterpolationFactor: vi.fn(() => 0),
            setFrameDuration: vi.fn()
        })),
        DemoRecorder: vi.fn().mockImplementation(() => ({
            startRecording: vi.fn(),
            stopRecording: vi.fn(),
            getIsRecording: vi.fn(() => false)
        })),
        ClientNetworkHandler: vi.fn().mockImplementation(() => ({
            setView: vi.fn(),
            setCallbacks: vi.fn(),
            latestServerFrame: 0,
            entities: new Map()
        })),
        DynamicLightManager: vi.fn().mockImplementation(() => ({
            update: vi.fn(),
            getActiveLights: vi.fn(() => [])
        }))
    };
});

describe('HUD Data API', () => {
  let client: any;
  let mockEngine: any;

  beforeEach(() => {
    mockEngine = {
      trace: vi.fn(() => ({ fraction: 1, endpos: { x: 0, y: 0, z: 0 } })),
      cmd: { executeText: vi.fn() },
      renderer: createMockRenderer({
          width: 800,
          height: 600,
          registerTexture: vi.fn().mockReturnValue({
            width: 32,
            height: 32,
            upload: vi.fn(),
            bind: vi.fn()
          })
      }),
      assets: createMockAssetManager()
    };

    client = createClient({ engine: mockEngine } as ClientImports);

    // Simulate init to set lastRendered (via mock prediction or manual injection if needed)
    // createClient sets lastRendered lazily in render().
    // We can manually set it or mock run a frame.
    // For test simplicity, let's trigger a render.

    client.init({
        state: {
            health: 100,
            armor: 50,
            ammo: 25,
            pickupIcon: 'icons/armor',
            damageIndicators: []
        } as any,
        timeMs: 0
    });

    // Force a render to populate lastRendered
    client.render({
        nowMs: 100,
        latest: {
            state: {
                health: 100,
                armor: 50,
                ammo: 25,
                pickupIcon: 'icons/armor',
                damageIndicators: [],
                origin: { x: 0, y: 0, z: 0 },
                velocity: { x: 0, y: 0, z: 0 },
                viewAngles: { x: 0, y: 0, z: 0 },
                blend: [0, 0, 0, 0]
            },
            timeMs: 100
        },
        previous: {
            state: {
                health: 100,
                armor: 50,
                ammo: 25,
                pickupIcon: 'icons/armor',
                damageIndicators: [],
                origin: { x: 0, y: 0, z: 0 },
                velocity: { x: 0, y: 0, z: 0 },
                viewAngles: { x: 0, y: 0, z: 0 },
                blend: [0, 0, 0, 0]
            },
            timeMs: 0
        },
        alpha: 1
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should return HUD data matching last rendered state', () => {
    const hudData = client.getHudData();
    expect(hudData).toBeDefined();
    expect(hudData.health).toBe(100);
    expect(hudData.armor).toBe(50);
    expect(hudData.ammo).toBe(25);
    expect(hudData.pickupIcon).toBe('icons/armor');
  });

  it('should return status bar data', () => {
    const statusBar = client.getStatusBar();
    expect(statusBar).toBeDefined();
    expect(statusBar.health).toBe(100);
    expect(statusBar.armor).toBe(50);
    expect(statusBar.ammo).toBe(25);
  });

  it('should return crosshair info', () => {
    const crosshair = client.getCrosshairInfo();
    expect(crosshair).toBeDefined();
    expect(crosshair.index).toBe(0); // Default
  });

  it('should trigger onHudUpdate callback', () => {
    const callback = vi.fn();
    client.onHudUpdate = callback;

    client.render({
        nowMs: 200,
        latest: {
            state: {
                health: 90,
                blend: [0, 0, 0, 0],
                origin: { x: 0, y: 0, z: 0 },
                velocity: { x: 0, y: 0, z: 0 },
                viewAngles: { x: 0, y: 0, z: 0 }
            },
            timeMs: 200
        },
        previous: {
            state: {
                health: 100,
                blend: [0, 0, 0, 0],
                origin: { x: 0, y: 0, z: 0 },
                velocity: { x: 0, y: 0, z: 0 },
                viewAngles: { x: 0, y: 0, z: 0 }
            },
            timeMs: 100
        },
        alpha: 1
    });

    expect(callback).toHaveBeenCalled();
    const data = callback.mock.calls[0][0];
    expect(data.health).toBe(90);
  });
});
