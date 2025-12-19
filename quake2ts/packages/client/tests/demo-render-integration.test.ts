
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createClient, ClientExports, ClientImports } from '../src/index.js';
import { ClientMode, ClientRenderer } from '../src/index.js';
import { EngineImports, GameRenderSample, PredictionState, EngineHost, Renderer, DemoPlaybackController, ClientNetworkHandler, RenderableEntity } from '@quake2ts/engine';
import { UserCommand } from '@quake2ts/shared';

// Mock dependencies
const mockTrace = vi.fn().mockReturnValue({ fraction: 1.0, endpos: { x: 0, y: 0, z: 0 }, contents: 0 });
const mockRenderer = {
  width: 800,
  height: 600,
  begin2D: vi.fn(),
  end2D: vi.fn(),
  renderFrame: vi.fn(),
  drawPic: vi.fn(),
  drawText: vi.fn(),
  measureText: vi.fn().mockReturnValue(10),
  setGamma: vi.fn(),
  setBrightness: vi.fn(),
  setBloom: vi.fn(),
  setBloomIntensity: vi.fn(),
  setUnderwaterWarp: vi.fn(),
} as unknown as Renderer;

const mockEngineImports: EngineImports = {
  trace: mockTrace,
  renderer: mockRenderer,
  assets: {
      getMap: vi.fn(),
      listFiles: vi.fn().mockReturnValue([]),
  } as any,
} as any;

const mockEngineHost: EngineHost = {
    cvars: {
        get: vi.fn(),
        setValue: vi.fn(),
        list: vi.fn().mockReturnValue([]),
        register: vi.fn(),
    },
    commands: {
        register: vi.fn(),
        execute: vi.fn(),
    }
} as any;

const mockClientImports: ClientImports = {
  engine: mockEngineImports,
  host: mockEngineHost
};

describe('Client Demo Playback Integration', () => {
  let client: ClientExports;

  beforeEach(() => {
    vi.clearAllMocks();
    client = createClient(mockClientImports);
  });

  it('should initialize in Normal mode', () => {
    expect(client.mode).toBe(ClientMode.Normal);
    expect(client.isDemoPlaying).toBe(false);
  });

  it('should transition to DemoPlayback mode when startDemoPlayback is called', () => {
    const buffer = new ArrayBuffer(100);
    client.startDemoPlayback(buffer, 'test.dm2');

    expect(client.mode).toBe(ClientMode.DemoPlayback);
    expect(client.isDemoPlaying).toBe(true);
    expect(client.currentDemoName).toBe('test.dm2');
  });

  it('should use demo entities and camera in render Sample when demo is playing', () => {
    // Setup demo mode
    const buffer = new ArrayBuffer(100);
    client.startDemoPlayback(buffer, 'test.dm2');

    // Mock demo handler methods
    const mockDemoHandler = client.demoHandler;
    const mockGetRenderableEntities = vi.spyOn(mockDemoHandler, 'getRenderableEntities');
    // Return a dummy entity to verify it's passed to renderFrame
    const dummyEntity = { modelIndex: 1 } as RenderableEntity;
    mockGetRenderableEntities.mockReturnValue([dummyEntity]);

    const mockGetDemoCamera = vi.spyOn(mockDemoHandler, 'getDemoCamera');
    mockGetDemoCamera.mockReturnValue({
        origin: { x: 200, y: 200, z: 200 }, // Different origin to verify override
        angles: { x: 0, y: 90, z: 0 },
        fov: 90
    });

    // Mock getPredictionState to avoid undefined lastRendered
    const mockGetPredictionState = vi.spyOn(mockDemoHandler, 'getPredictionState');
    mockGetPredictionState.mockReturnValue({
        origin: { x: 100, y: 100, z: 100 },
        velocity: { x: 0, y: 0, z: 0 },
        viewAngles: { x: 0, y: 90, z: 0 },
        pmFlags: 0,
        waterLevel: 0,
        frame: 0
    } as any);


    // Call render (Sample)
    const sample: GameRenderSample<PredictionState> = {
      nowMs: 1000,
      alpha: 1.0,
      latest: {
          timeMs: 1000,
          state: {} as any,
          command: {} as any,
          events: []
      }
    };

    client.render(sample);

    // Verify demo handler was called
    expect(mockGetRenderableEntities).toHaveBeenCalled();
    expect(mockGetPredictionState).toHaveBeenCalled();

    // Verify renderer was called with demo camera and entities
    const renderCall = (mockRenderer.renderFrame as any).mock.calls[0];
    const camera = renderCall[0].camera;
    const entities = renderCall[1];

    expect(camera).toBeDefined();
    // Check camera position (Float32Array)
    expect(camera.position[0]).toBeCloseTo(200);
    expect(camera.position[1]).toBeCloseTo(200);
    expect(camera.position[2]).toBeCloseTo(200);
    // Check camera FOV (should be 90 from demo state)
    expect(camera.fov).toBe(90);

    // Check entities
    expect(entities).toHaveLength(1);
    expect(entities[0]).toBe(dummyEntity);
  });

  it('should stop demo playback and revert to Normal mode', () => {
    const buffer = new ArrayBuffer(100);
    client.startDemoPlayback(buffer, 'test.dm2');
    client.stopDemoPlayback();

    expect(client.mode).toBe(ClientMode.Normal);
    expect(client.isDemoPlaying).toBe(false);
    expect(client.currentDemoName).toBeNull();
  });
});
