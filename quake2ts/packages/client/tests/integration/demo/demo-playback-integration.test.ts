import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createClient, ClientExports, ClientImports, ClientMode } from '@quake2ts/client';
import { DemoPlaybackController, EngineImports } from '@quake2ts/engine';
import { ClientNetworkHandler } from '../../../src/demo/handler.js';
import { DemoControls } from '@quake2ts/client';

const { mockEngineAssets } = vi.hoisted(() => {
    return {
        mockEngineAssets: {
            listFiles: vi.fn().mockReturnValue([]),
            getMap: vi.fn(),
            loadTexture: vi.fn().mockResolvedValue({ width: 32, height: 32 }),
            loadSprite: vi.fn(), // If needed
            loadPcx: vi.fn() // If needed
        }
    };
});

// Mock dependencies
vi.mock('@quake2ts/engine', async () => {
    const actual = await vi.importActual('@quake2ts/engine');
    return {
        ...actual,
        DemoPlaybackController: class {
            loadDemo = vi.fn();
            setHandler = vi.fn();
            update = vi.fn();
            stop = vi.fn();
            setSpeed = vi.fn();
            setFrameDuration = vi.fn();
            getCurrentTime = vi.fn().mockReturnValue(0);
            getDuration = vi.fn().mockReturnValue(100);
            getState = vi.fn();
            getSpeed = vi.fn().mockReturnValue(1);
            getPlaybackSpeed = vi.fn().mockReturnValue(1);
            getInterpolationFactor = vi.fn().mockReturnValue(0);
            play = vi.fn();
            pause = vi.fn();
            stepForward = vi.fn();
            stepBackward = vi.fn();
            seek = vi.fn();
            getCurrentFrame = vi.fn().mockReturnValue(0);
            getTotalFrames = vi.fn().mockReturnValue(100);
        },
        ClientRenderer: vi.fn(),
        createEmptyEntityState: vi.fn().mockReturnValue({ origin: {x:0,y:0,z:0} })
    };
});

vi.mock('../../../src/demo/handler.js', () => ({
    ClientNetworkHandler: class {
        setView = vi.fn();
        setCallbacks = vi.fn();
        getPredictionState = vi.fn().mockReturnValue({
             origin: { x: 0, y: 0, z: 0 },
             velocity: { x: 0, y: 0, z: 0 },
             viewAngles: { x: 0, y: 0, z: 0 },
             pmFlags: 0,
             fov: 90,
             client: {} // Added client property to satisfy rendering condition
        });
        getRenderableEntities = vi.fn().mockReturnValue([]);
        getDemoCamera = vi.fn().mockReturnValue({
             origin: { x: 0, y: 0, z: 0 },
             angles: { x: 0, y: 0, z: 0 },
             fov: 90
        });
        latestServerFrame = 100;
    }
}));

vi.mock('@quake2ts/client', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual as any,
        DemoControls: vi.fn(function() {
            return {
                render: vi.fn(),
                handleInput: vi.fn().mockReturnValue(false),
                setDemoName: vi.fn()
            };
        })
    };
});

// Mock cgameBridge to avoid complex dependencies
vi.mock('../../../src/cgameBridge.js', () => ({
    createCGameImport: vi.fn(),
    ClientStateProvider: vi.fn()
}));

// Mock HUD using path relative to test file.
// We mock it to do nothing to avoid asset loading issues.
vi.mock('../../../src/hud.js', () => ({
    Init_Hud: vi.fn().mockResolvedValue(undefined),
    Draw_Hud: vi.fn()
}));

vi.mock('@quake2ts/cgame', async () => {
  return {
    ClientPrediction: class {
        setAuthoritative = vi.fn();
        enqueueCommand = vi.fn();
        getPredictedState = vi.fn();
    },
    interpolatePredictionState: vi.fn(),
    ViewEffects: class {
        sample = vi.fn();
    },
    GetCGameAPI: vi.fn().mockReturnValue({
        Init: vi.fn(),
        Shutdown: vi.fn(),
        DrawHUD: vi.fn(),
        ParseCenterPrint: vi.fn(),
        NotifyMessage: vi.fn(),
        ParseConfigString: vi.fn(),
        ShowSubtitle: vi.fn()
    })
  }
});

vi.mock('../../../src/ui/menu/system.js', () => ({
    MenuSystem: class {
        isActive = vi.fn().mockReturnValue(false);
        closeAll = vi.fn();
        pushMenu = vi.fn();
        render = vi.fn();
        handleInput = vi.fn();
        getState = vi.fn().mockReturnValue({});
        onStateChange = null;
    }
}));

describe('Demo Playback Integration', () => {
    let client: ClientExports;
    let mockEngine: EngineImports & { renderer: any, cmd: any };
    let mockRenderer: any;

    beforeEach(() => {
        vi.clearAllMocks();

        mockRenderer = {
            width: 800,
            height: 600,
            renderFrame: vi.fn(),
            begin2D: vi.fn(),
            end2D: vi.fn(),
            drawfillRect: vi.fn(),
            drawString: vi.fn(),
            drawCenterString: vi.fn(),
            registerTexture: vi.fn(),
            registerPic: vi.fn(),
            getPerformanceReport: vi.fn().mockReturnValue({ textureBinds: 0, drawCalls: 0, triangles: 0, vertices: 0 }),
            setGamma: vi.fn(),
            setBrightness: vi.fn(),
            setBloom: vi.fn(),
            setBloomIntensity: vi.fn(),
            setUnderwaterWarp: vi.fn(),
        };

        mockEngine = {
            trace: vi.fn().mockReturnValue({ fraction: 1.0, endpos: { x: 0, y: 0, z: 0 } }),
            assets: mockEngineAssets as any,
            renderer: mockRenderer,
            cmd: {
                executeText: vi.fn(),
                register: vi.fn()
            },
            audio: {
                sound: vi.fn(),
                positioned_sound: vi.fn(),
                set_music_volume: vi.fn(), // Mock set_music_volume
                play_track: vi.fn(),
                play_music: vi.fn(),
                stop_music: vi.fn()
            } as any
        } as any;

        const imports: ClientImports = {
            engine: mockEngine,
            host: {
                cvars: {
                    get: vi.fn().mockReturnValue({ string: '', number: 90 }),
                    setValue: vi.fn(),
                    list: vi.fn().mockReturnValue([]),
                    register: vi.fn()
                },
                commands: {
                    register: vi.fn(),
                    execute: vi.fn()
                }
            } as any
        };

        client = createClient(imports);
        client.Init();
    });

    it('should initialize in Normal mode', () => {
        expect(client.mode).toBe(ClientMode.Normal);
        expect(client.isDemoPlaying).toBe(false);
        expect(client.currentDemoName).toBeNull();
    });

    it('should start demo playback correctly', () => {
        const buffer = new ArrayBuffer(100);
        const filename = 'test.dm2';

        client.startDemoPlayback(buffer, filename);

        expect(client.mode).toBe(ClientMode.DemoPlayback);
        expect(client.isDemoPlaying).toBe(true);
        expect(client.currentDemoName).toBe(filename);

        expect(client.demoPlayback.loadDemo).toHaveBeenCalledWith(buffer);
        expect(client.demoPlayback.setHandler).toHaveBeenCalledWith(client.demoHandler);
    });

    it('should stop demo playback correctly', () => {
        // First start
        client.startDemoPlayback(new ArrayBuffer(10), 'test.dm2');

        // Then stop
        client.stopDemoPlayback();

        expect(client.mode).toBe(ClientMode.Normal);
        expect(client.isDemoPlaying).toBe(false);
        expect(client.currentDemoName).toBeNull();
        expect(client.demoPlayback.stop).toHaveBeenCalled();
    });

    it('should update demo playback in sample loop', () => {
        client.startDemoPlayback(new ArrayBuffer(10), 'test.dm2');

        const sample = {
            nowMs: 1000,
            alpha: 1.0,
            latest: null,
            previous: null
        };

        client.render(sample);

        // Should call demoPlayback.update
        // First call sets lastRenderTime, so update might be called with 0 or small dt
        // Let's call it twice to ensure dt > 0
        client.render({ ...sample, nowMs: 1016 });

        expect(client.demoPlayback.update).toHaveBeenCalled();
    });

    it('should use demo camera and entities during playback', () => {
        client.startDemoPlayback(new ArrayBuffer(10), 'test.dm2');

        client.render({ nowMs: 1000, alpha: 1.0, latest: null, previous: null });

        expect(client.demoHandler.getRenderableEntities).toHaveBeenCalled();
        expect(client.demoHandler.getDemoCamera).toHaveBeenCalled();
        expect(mockRenderer.renderFrame).toHaveBeenCalled();
    });

    it('should render demo controls', () => {
        client.startDemoPlayback(new ArrayBuffer(10), 'test.dm2');

        // Mock render loop that eventually calls DrawHUD
        client.render({ nowMs: 1000, alpha: 1.0, latest: null, previous: null });

        // Access the mocked instance of DemoControls
        const controlsMock = vi.mocked(DemoControls).mock.results[0].value;

        // We expect the controls to be rendered
        expect(controlsMock.render).toHaveBeenCalledWith(mockRenderer, mockRenderer.width, mockRenderer.height);
    });

    it('should handle demo input', () => {
        client.startDemoPlayback(new ArrayBuffer(10), 'test.dm2');

        // Mock demoControls to return true for a key
        const controlsMock = vi.mocked(DemoControls).mock.results[0].value;
        controlsMock.handleInput.mockReturnValue(true);

        const consumed = client.handleInput('Space', true);
        expect(consumed).toBe(true);
        expect(controlsMock.handleInput).toHaveBeenCalledWith('Space', true);
    });

    it('should allow togglemenu during demo playback', () => {
         client.startDemoPlayback(new ArrayBuffer(10), 'test.dm2');

         const controlsMock = vi.mocked(DemoControls).mock.results[0].value;
         controlsMock.handleInput.mockReturnValue(false); // Not consumed by demo controls

         const consumed = client.handleInput('Escape', true);

         expect(consumed).toBe(false);
    });
});
