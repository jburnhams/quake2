import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createClient, ClientImports, ClientExports, ClientMode } from '../../src/index.js';
import { EngineImports, DemoPlaybackController } from '@quake2ts/engine';
import { ClientNetworkHandler } from '../../src/demo/handler.js';

// Mock dependencies
const mockEngineImports: EngineImports = {
    renderer: {
        width: 800,
        height: 600,
        renderFrame: vi.fn(),
        begin2D: vi.fn(),
        end2D: vi.fn(),
        drawfillRect: vi.fn(),
        drawString: vi.fn(),
        drawCenterString: vi.fn(),
        stats: undefined
    },
    audio: {
        sound: vi.fn(),
        positioned_sound: vi.fn()
    },
    trace: vi.fn().mockReturnValue({ contents: 0, fraction: 1.0, endpos: {x:0,y:0,z:0} }),
    assets: {
        getMap: vi.fn(),
        listFiles: vi.fn()
    }
} as any;

const mockDemoPlayback = {
    loadDemo: vi.fn(),
    setHandler: vi.fn(),
    stop: vi.fn(),
    update: vi.fn(),
    getState: vi.fn().mockReturnValue(0), // PlaybackState.Stopped
    setFrameDuration: vi.fn(),
    play: vi.fn(),
    pause: vi.fn(),
    setSpeed: vi.fn(),
    getSpeed: vi.fn().mockReturnValue(1.0),
    getCurrentTime: vi.fn().mockReturnValue(0)
};

const mockDemoHandler = {
    setCallbacks: vi.fn(),
    setView: vi.fn(),
    onServerData: vi.fn(),
    onConfigString: vi.fn(),
    getRenderableEntities: vi.fn().mockReturnValue([]),
    getDemoCamera: vi.fn().mockReturnValue({
        origin: { x: 0, y: 0, z: 0 },
        angles: { x: 0, y: 0, z: 0 },
        fov: 90
    }),
    getPredictionState: vi.fn().mockReturnValue({
        origin: { x: 0, y: 0, z: 0 },
        velocity: { x: 0, y: 0, z: 0 },
        viewAngles: { x: 0, y: 0, z: 0 },
        pmFlags: 0,
        pmType: 0,
        waterLevel: 0,
        gravity: 800,
        deltaAngles: { x: 0, y: 0, z: 0 },
        client: {},
        stats: new Array(32).fill(0),
        blend: [0, 0, 0, 0],
        damageAlpha: 0,
        damageIndicators: [],
        kick_angles: { x: 0, y: 0, z: 0 },
        kick_origin: { x: 0, y: 0, z: 0 },
        gunoffset: { x: 0, y: 0, z: 0 },
        gunangles: { x: 0, y: 0, z: 0 },
        gunindex: 0,
        mins: { x: -16, y: -16, z: -24 },
        maxs: { x: 16, y: 16, z: 32 }
    }),
    latestServerFrame: 0
};

// Mock the modules
vi.mock('@quake2ts/engine', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual as any,
    DemoPlaybackController: vi.fn(() => mockDemoPlayback),
  };
});

// Mock local ClientNetworkHandler
vi.mock('../../src/demo/handler.js', () => {
    return {
        ClientNetworkHandler: vi.fn(() => mockDemoHandler)
    };
});

describe('Client Demo Playback Integration', () => {
    let client: ClientExports;
    const imports: ClientImports = {
        engine: mockEngineImports
    };

    beforeEach(() => {
        vi.clearAllMocks();
        client = createClient(imports);
    });

    it('should have demo playback state initialized', () => {
        expect(client.isDemoPlaying).toBe(false);
        expect(client.currentDemoName).toBeNull();
        // expect(client.mode).toBe(ClientMode.Normal); // If exposed
    });

    it('should start demo playback correctly', () => {
        const buffer = new ArrayBuffer(100);
        const filename = 'testdemo.dm2';

        client.startDemoPlayback(buffer, filename);

        expect(mockDemoPlayback.loadDemo).toHaveBeenCalledWith(buffer);
        // Expect setHandler to be called with the mocked handler
        expect(mockDemoPlayback.setHandler).toHaveBeenCalledWith(mockDemoHandler);
        expect(client.isDemoPlaying).toBe(true);
        expect(client.currentDemoName).toBe(filename);
    });

    it('should stop demo playback correctly', () => {
        // First start to set state
        client.startDemoPlayback(new ArrayBuffer(10), 'demo.dm2');

        client.stopDemoPlayback();

        expect(mockDemoPlayback.stop).toHaveBeenCalled();
        expect(client.isDemoPlaying).toBe(false);
        expect(client.currentDemoName).toBeNull();
    });

    it('should update demo playback in render loop when playing', () => {
        client.startDemoPlayback(new ArrayBuffer(10), 'demo.dm2');

        // First frame (initializes lastRenderTime)
        client.render({
            latest: { timeMs: 100 },
            previous: { timeMs: 50 },
            alpha: 0.5,
            nowMs: 1000,
            accumulatorMs: 0,
            frame: 1
        } as any);

        // First frame has dt=0 because lastRenderTime was 0
        expect(mockDemoPlayback.update).toHaveBeenCalledWith(0);

        // Second frame (50ms later)
        client.render({
            latest: { timeMs: 150 },
            previous: { timeMs: 100 },
            alpha: 0.5,
            nowMs: 1050,
            accumulatorMs: 0,
            frame: 2
        } as any);

        // dt calculation: 1050 - 1000 = 50ms
        expect(mockDemoPlayback.update).toHaveBeenCalledWith(50);
        expect(mockDemoHandler.getPredictionState).toHaveBeenCalledWith(0);
    });

    it('should not update demo playback when not playing', () => {
        const sample = {
            latest: { timeMs: 100 },
            previous: { timeMs: 50 },
            alpha: 0.5
        } as any;

        client.render(sample);

        expect(mockDemoPlayback.update).not.toHaveBeenCalled();
    });
});
