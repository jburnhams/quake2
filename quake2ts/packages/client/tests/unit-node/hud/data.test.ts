import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createClient, ClientImports } from '@quake2ts/client/index.js';
import { ClientPrediction } from '@quake2ts/cgame';
import { DemoPlaybackController } from '@quake2ts/engine';
import { createMockHudState, createMockAssetManager, createMockRenderer } from '@quake2ts/test-utils';

// Mocks
vi.mock('@quake2ts/cgame', async (importOriginal) => {
    const actual = await importOriginal();
    // Use helper to create consistent mock state
    const { createMockHudState } = await import('@quake2ts/test-utils');
    const mockState = createMockHudState({
        health: 100,
        armor: 50,
        ammo: 25,
        pickupIcon: 'icons/armor',
        damageIndicators: []
    });

    return {
        ...(actual as object),
        ClientPrediction: class {
            constructor() {
                return {
                    setAuthoritative: vi.fn(),
                    getPredictedState: vi.fn(() => mockState),
                    enqueueCommand: vi.fn(),
                    decayError: vi.fn()
                };
            }
        },
        GetCGameAPI: vi.fn(() => ({
            Init: vi.fn(),
            Shutdown: vi.fn(),
            DrawHUD: vi.fn(),
            ParseCenterPrint: vi.fn(),
            NotifyMessage: vi.fn(),
            ParseConfigString: vi.fn(),
            ShowSubtitle: vi.fn()
        })),
        // Mock interpolation to just return the destination state to preserve properties like pickupIcon
        // without relying on complex interpolation logic in unit tests
        interpolatePredictionState: vi.fn((from, to, alpha) => to)
    };
});

vi.mock('@quake2ts/engine', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...(actual as object),
        DemoPlaybackController: class {
            constructor() {
                return {
                    loadDemo: vi.fn(),
                    setHandler: vi.fn(),
                    update: vi.fn(),
                    getCurrentTime: vi.fn(() => 0),
                    getInterpolationFactor: vi.fn(() => 0),
                    setFrameDuration: vi.fn()
                };
            }
        },
        DemoRecorder: class {
            constructor() {
                return {
                    startRecording: vi.fn(),
                    stopRecording: vi.fn(),
                    getIsRecording: vi.fn(() => false)
                };
            }
        },
        ClientNetworkHandler: class {
            constructor() {
                return {
                    setView: vi.fn(),
                    setCallbacks: vi.fn(),
                    latestServerFrame: 0,
                    entities: new Map()
                };
            }
        },
        DynamicLightManager: class {
            constructor() {
                return {
                    update: vi.fn(),
                    getActiveLights: vi.fn(() => [])
                };
            }
        }
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

    const initialState = createMockHudState({
        health: 100,
        armor: 50,
        ammo: 25,
        pickupIcon: 'icons/armor',
        damageIndicators: []
    });

    client.init({
        state: initialState as any,
        timeMs: 0
    });

    // Force a render to populate lastRendered
    client.render({
        nowMs: 100,
        latest: {
            state: {
                ...initialState,
                origin: { x: 0, y: 0, z: 0 },
                velocity: { x: 0, y: 0, z: 0 },
                viewAngles: { x: 0, y: 0, z: 0 },
                blend: [0, 0, 0, 0]
            },
            timeMs: 100
        },
        previous: {
            state: {
                ...initialState,
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

    const updatedState = createMockHudState({
        health: 90
    });

    client.render({
        nowMs: 200,
        latest: {
            state: {
                ...updatedState,
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
